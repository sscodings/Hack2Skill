// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/SakshamAuditRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("ANCHOR_WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);

        require(deployer.balance > 0, "Wallet has no POL. Get testnet POL from faucet first.");

        vm.startBroadcast(deployerPrivateKey);

        SakshamAuditRegistry deployedContract = new SakshamAuditRegistry();

        vm.stopBroadcast();

        console.log("==================================");
        console.log("CONTRACT DEPLOYED SUCCESSFULLY");
        console.log("==================================");
        console.log("Contract address:", address(deployedContract));
        console.log("Network: Polygon Amoy Testnet");
        console.log("View on Polygonscan:");
        console.log("https://amoy.polygonscan.com/address/", address(deployedContract));
        console.log("==================================");
        console.log("Add this to your backend/.env:");
        console.log("CONTRACT_ADDRESS=", address(deployedContract));
        console.log("==================================");
    }
}
