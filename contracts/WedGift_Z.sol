pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedGiftRegistry is ZamaEthereumConfig {
    
    struct Gift {
        string encryptedMessage;       
        euint32 encryptedAmount;       
        address sender;                
        uint256 timestamp;             
        bool isRedeemed;               
        uint32 decryptedAmount;        
    }
    
    mapping(string => Gift) public gifts;
    string[] public giftIds;
    
    event GiftCreated(string indexed giftId, address indexed sender);
    event GiftRedeemed(string indexed giftId, uint32 amount);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function createGift(
        string calldata giftId,
        externalEuint32 encryptedAmount,
        bytes calldata amountProof,
        string calldata encryptedMessage,
        bytes calldata messageProof
    ) external {
        require(bytes(gifts[giftId].encryptedMessage).length == 0, "Gift already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedAmount, amountProof)), "Invalid encrypted amount");
        
        gifts[giftId] = Gift({
            encryptedMessage: encryptedMessage,
            encryptedAmount: FHE.fromExternal(encryptedAmount, amountProof),
            sender: msg.sender,
            timestamp: block.timestamp,
            isRedeemed: false,
            decryptedAmount: 0
        });
        
        FHE.allowThis(gifts[giftId].encryptedAmount);
        FHE.makePubliclyDecryptable(gifts[giftId].encryptedAmount);
        
        giftIds.push(giftId);
        
        emit GiftCreated(giftId, msg.sender);
    }
    
    function redeemGift(
        string calldata giftId,
        bytes memory abiEncodedClearAmount,
        bytes memory decryptionProof
    ) external {
        require(bytes(gifts[giftId].encryptedMessage).length > 0, "Gift does not exist");
        require(!gifts[giftId].isRedeemed, "Gift already redeemed");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(gifts[giftId].encryptedAmount);
        
        FHE.checkSignatures(cts, abiEncodedClearAmount, decryptionProof);
        
        uint32 decodedAmount = abi.decode(abiEncodedClearAmount, (uint32));
        
        gifts[giftId].decryptedAmount = decodedAmount;
        gifts[giftId].isRedeemed = true;
        
        emit GiftRedeemed(giftId, decodedAmount);
    }
    
    function getGiftDetails(string calldata giftId) external view returns (
        string memory encryptedMessage,
        address sender,
        uint256 timestamp,
        bool isRedeemed,
        uint32 decryptedAmount
    ) {
        require(bytes(gifts[giftId].encryptedMessage).length > 0, "Gift does not exist");
        Gift storage gift = gifts[giftId];
        
        return (
            gift.encryptedMessage,
            gift.sender,
            gift.timestamp,
            gift.isRedeemed,
            gift.decryptedAmount
        );
    }
    
    function getAllGiftIds() external view returns (string[] memory) {
        return giftIds;
    }
    
    function getEncryptedAmount(string calldata giftId) external view returns (euint32) {
        require(bytes(gifts[giftId].encryptedMessage).length > 0, "Gift does not exist");
        return gifts[giftId].encryptedAmount;
    }
    
    function serviceStatus() external pure returns (bool operational) {
        return true;
    }
}

