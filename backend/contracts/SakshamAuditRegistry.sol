// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title SakshamAuditRegistry
/// @notice On-chain audit registry for anchoring MSME score records with
///         a payload hash and an IPFS content identifier.
contract SakshamAuditRegistry {
    struct Record {
        bytes32 payloadHash;
        string  ipfsCID;
        uint256 timestamp;
        address submitter;
    }

    mapping(string => Record) private records;

    event RecordAnchored(
        string  indexed recordKey,
        bytes32         payloadHash,
        string          ipfsCID,
        address         submitter
    );

    /// @notice Anchor a new record on-chain.
    /// @param recordKey  Unique key (e.g. "msmeId:scoreId").
    /// @param payloadHash SHA-256 hash of the JSON payload (as bytes32).
    /// @param ipfsCID    IPFS CID where the full payload is pinned.
    function anchorRecord(
        string  calldata recordKey,
        bytes32          payloadHash,
        string  calldata ipfsCID
    ) external {
        records[recordKey] = Record({
            payloadHash: payloadHash,
            ipfsCID:     ipfsCID,
            timestamp:   block.timestamp,
            submitter:   msg.sender
        });

        emit RecordAnchored(recordKey, payloadHash, ipfsCID, msg.sender);
    }

    /// @notice Retrieve a stored record.
    /// @param recordKey Unique key to look up.
    /// @return payloadHash, ipfsCID, timestamp, submitter
    function getRecord(string calldata recordKey)
        external
        view
        returns (bytes32, string memory, uint256, address)
    {
        Record storage r = records[recordKey];
        return (r.payloadHash, r.ipfsCID, r.timestamp, r.submitter);
    }

    /// @notice Verify whether a given hash matches the stored hash for a key.
    /// @param recordKey  Key to look up.
    /// @param hashToCheck Hash to compare against the stored value.
    /// @return true if the hashes match, false otherwise.
    function verifyHash(string calldata recordKey, bytes32 hashToCheck)
        external
        view
        returns (bool)
    {
        return records[recordKey].payloadHash == hashToCheck;
    }
}
