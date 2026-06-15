// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IntrusionLog {
    struct Log {
        string ip;
        string attackType;
        uint256 confidence;
        uint256 timestamp;
    }

    Log[] public logs;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function storeLog(string memory _ip, string memory _attackType, uint256 _confidence) public onlyOwner {
        logs.push(Log(_ip, _attackType, _confidence, block.timestamp));
    }

    function getAllLogs() public view returns (Log[] memory) {
        return logs;
    }

    function getLogCount() public view returns (uint256) {
        return logs.length;
    }

    function getLog(uint256 index) public view returns (string memory, string memory, uint256, uint256) {
        Log memory l = logs[index];
        return (l.ip, l.attackType, l.confidence, l.timestamp);
    }
}
