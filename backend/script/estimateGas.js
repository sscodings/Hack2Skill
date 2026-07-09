const { ethers } = require("ethers");
require("dotenv").config();

const abi = require("../contracts/SakshamAuditRegistry.json");

async function main() {
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
  const privateKey = process.env.ANCHOR_WALLET_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const recordKey = "msme-001:score-uuid-1234";
  const payloadHash = "0x" + "1".repeat(64);
  const ipfsCID = "QmPlaceholderCidForRecord";

  try {
    const gasEstimate = await contract.anchorRecord.estimateGas(recordKey, payloadHash, ipfsCID);
    const feeData = await provider.getFeeData();
    
    // Convert to BigInt explicitly if needed, but modern ethers handles it.
    const maxFee = feeData.maxFeePerGas || feeData.gasPrice;
    const costWei = gasEstimate * maxFee;
    const costPol = ethers.formatEther(costWei);

    console.log(`Gas estimate (units): ${gasEstimate.toString()}`);
    console.log(`Max fee per gas (gwei): ${ethers.formatUnits(maxFee, "gwei")}`);
    console.log(`Estimated cost in POL: ${costPol}`);
  } catch (err) {
    console.error("Error estimating gas:", err);
  }
}

main();
