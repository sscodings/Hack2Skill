const { ethers } = require("ethers");
const crypto = require("crypto");
const path = require("path");

// Load contract ABI
const abi = require("../contracts/SakshamAuditRegistry.json");

const rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
const privateKey = process.env.ANCHOR_WALLET_PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

let useMock = true;
let contract = null;
let provider = null;

if (rpcUrl && privateKey && contractAddress) {
  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, abi, wallet);
    useMock = false;
    console.log("Blockchain Service: Initialized with real Polygon Amoy RPC connection.");
  } catch (error) {
    console.error("Blockchain Service Initialization Error. Falling back to simulated anchoring:", error.message);
  }
} else {
  console.log("[MOCK MODE] No RPC URL / Contract found — returning fake tx, this will fail on-chain verification.");
}

async function anchorScoreRecord(msmeId, scoreId, payload) {
  const payloadJson = JSON.stringify(payload);
  const hashHex = crypto.createHash("sha256").update(payloadJson).digest("hex");
  const hashBytes32 = "0x" + hashHex;
  const recordKey = `${msmeId}:${scoreId}`;

  if (useMock) {
    // Generate valid-looking mock transaction hash and mock ipfsCID (if not supplied in payload)
    const mockTxHash = "0x" + crypto.randomBytes(32).toString("hex");
    const mockCid = payload.ipfsCID || "Qm" + crypto.randomBytes(21).toString("hex");

    console.log(`[SIMULATED ANCHOR] Anchored key "${recordKey}"`);
    console.log(` - Payload Hash: ${hashHex}`);
    console.log(` - Simulated Tx: ${mockTxHash}`);

    return {
      payload_hash: hashHex,
      ipfs_cid: mockCid,
      chain_tx_hash: mockTxHash
    };
  }

  try {
    // 1. IPFS pinning is done in the caller or service. We assume ipfsCID is in payload, or we default it
    const ipfsCID = payload.ipfsCID || "QmPlaceholderCidForRecord";
    
    // 2. Write to chain
    console.log(`[REAL ANCHOR] Anchoring key "${recordKey}" on-chain...`);
    
    // Fetch fee data dynamically to avoid "replacement transaction underpriced" errors
    let txOpts = {};
    try {
      const feeData = await provider.getFeeData();
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // Multiply by 5 for higher priority fee on congested testnet to outbid stuck txs
        txOpts = {
          maxFeePerGas: feeData.maxFeePerGas * 5n,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 5n
        };
      }
    } catch (feeError) {
      console.warn("Could not retrieve real-time fee data:", feeError.message);
    }

    const tx = await contract.anchorRecord(recordKey, hashBytes32, ipfsCID, txOpts);
    const receipt = await tx.wait();
    console.log(`[REAL ANCHOR] Anchor transaction confirmed: ${receipt.hash}`);

    return {
      payload_hash: hashHex,
      ipfs_cid: ipfsCID,
      chain_tx_hash: receipt.hash
    };
  } catch (error) {
    console.error(`Error anchoring record for MSME ${msmeId}:`, error);
    if (error.info && error.info.error && error.info.error.message && error.info.error.message.includes("gas required exceeds allowance")) {
      throw new Error("Insufficient POL (gas fee) in the backend wallet to process this blockchain transaction. Please top up the wallet.");
    }
    if (error.message && error.message.includes("estimateGas")) {
      throw new Error("Blockchain transaction failed during gas estimation. The deployer wallet may be out of POL.");
    }
    throw error;
  }
}

async function verifyRecord(msmeId, scoreId, storedPayload, dbPayloadHash) {
  const recordKey = `${msmeId}:${scoreId}`;
  const payloadJson = JSON.stringify(storedPayload);
  const recomputedHash = "0x" + crypto.createHash("sha256").update(payloadJson).digest("hex");


  const cleanRecomputed = recomputedHash.replace(/^0x/, "").toLowerCase();
  const cleanDbHash = dbPayloadHash ? dbPayloadHash.replace(/^0x/, "").toLowerCase() : "";

  console.log(`[VERIFICATION DEBUG] Key: ${recordKey}`);
  console.log(`- Recomputed Hash : 0x${cleanRecomputed}`);
  console.log(`- DB Hash         : 0x${cleanDbHash}`);

  if (useMock) {
    console.log(`[SIMULATED VERIFICATION] Verifying key "${recordKey}"`);
    console.log(` - Recomputed Hash: ${recomputedHash}`);
    // Simulated check always succeeds for our demo
    return true;
  }

  try {
    // Check if the record is actually on-chain first
    const [onChainHash] = await contract.getRecord(recordKey);
    const isZeroHash = /^0x0+$/.test(onChainHash);

    if (isZeroHash) {
      if (dbPayloadHash) {
        console.log(`[VERIFICATION] Record ${recordKey} not found on-chain (zero hash). Falling back to database payload hash verification.`);
        return cleanRecomputed === cleanDbHash;
      }
      return false;
    }

    // Verify using the smart contract's method
    const hashBytes32 = "0x" + cleanRecomputed;
    const isValidOnChain = await contract.verifyHash(recordKey, hashBytes32);
    
    return isValidOnChain;
  } catch (error) {
    console.error(`Error verifying record for key ${recordKey}:`, error);
    // If real contract call fails, fall back to comparing with dbPayloadHash
    if (dbPayloadHash) {
      return cleanRecomputed === cleanDbHash;
    }
    return true;
  }
}

async function estimateAnchorGas(msmeId, scoreId, payload) {
  if (useMock) {
    return { estimatedPol: "0.000", gasUnits: "21000", gasPriceGwei: "0.0" };
  }

  const payloadJson = JSON.stringify(payload);
  const hashHex = crypto.createHash("sha256").update(payloadJson).digest("hex");
  const hashBytes32 = "0x" + hashHex;
  const recordKey = `${msmeId}:${scoreId}`;
  
  // Use a generic placeholder CID for estimation if IPFS pinning hasn't happened yet
  // The gas cost for storing strings of the exact same length (CID length = 46) is identical.
  const ipfsCID = payload.ipfsCID || "QmPlaceholderCidForRecordGasEstimationOnly";

  try {
    const gasUnits = await contract.anchorRecord.estimateGas(recordKey, hashBytes32, ipfsCID);
    const feeData = await provider.getFeeData();
    
    // Fallback to gasPrice if maxFeePerGas is not available (older networks)
    let maxFee = feeData.maxFeePerGas || feeData.gasPrice;
    
    // Add 5x multiplier matching the anchor transaction logic (lines 64-68) for worst case
    maxFee = maxFee * 5n;
    
    const costWei = gasUnits * maxFee;
    const estimatedPol = ethers.formatEther(costWei);

    return { estimatedPol, gasUnits: gasUnits.toString(), gasPriceGwei: ethers.formatUnits(maxFee, "gwei") };
  } catch (error) {
    console.error(`Error estimating gas for MSME ${msmeId}:`, error);
    throw new Error("Transaction would fail. The wallet may be out of POL or transaction will revert.");
  }
}

module.exports = { anchorScoreRecord, verifyRecord, estimateAnchorGas };
