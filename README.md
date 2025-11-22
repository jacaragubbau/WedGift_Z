# WedGift_Z: A Privacy-Preserving Wedding Gift Platform

WedGift_Z is an innovative application that revolutionizes the way wedding gifts are exchanged by ensuring complete privacy. Leveraging Zama's Fully Homomorphic Encryption (FHE) technology, WedGift_Z allows users to send encrypted monetary gifts to newlyweds, enabling them to decrypt the amount only when they choose to do so. This approach preserves the sensitive nature of gift amounts, making it a secure and respectful solution for all wedding attendees.

## The Problem

In today’s digital age, sharing monetary gifts often involves revealing sensitive information, including the exact amount given. This lack of privacy can lead to discomfort and unwanted scrutiny, making gift-giving feel less personal and more transactional. Traditional methods of sharing gifts do not encompass the importance of privacy, leaving both givers and receivers exposed to potential judgment or awkward situations. The need for a respectful and private way to send gifts during celebrations like weddings is paramount.

## The Zama FHE Solution

WedGift_Z addresses this challenge through the power of Fully Homomorphic Encryption (FHE). Utilizing Zama's advanced encryption technology, we enable computation on encrypted data, allowing gift amounts to be shared without disclosing them to all parties involved. 

By using the Zama FHE libraries, specifically the fhevm, we can process encrypted inputs safely and securely. This ensures that only the recipient, when ready, can decrypt and view the total amount gifted, maintaining both surprise and privacy. 

## Key Features

- 🎁 **Encrypted Monetary Gifts**: Send gifts that remain confidential until the recipients decide to view them.
- 🔒 **Privacy Focused**: Protect the identity and amount of each gift, ensuring respectful financial exchanges.
- 💌 **Personalized Messages**: Along with the gift, send encrypted heartfelt wishes—because every gift carries love.
- 🎉 **User-Friendly Interface**: A seamless experience for givers and receivers, making the process smooth and enjoyable.
- 🛡️ **Secure Transactions**: Built on Zama’s FHE technology to ensure all transfers are safe from prying eyes.

## Technical Architecture & Stack

WedGift_Z is constructed using the following technology stack:

- **Core Privacy Engine**: Zama's fhevm
- **Frontend**: JavaScript with the React framework for a responsive user interface
- **Backend**: Node.js for handling requests and managing encrypted data
- **Database**: MongoDB for secure storage of users' encrypted data
- **Smart Contracts**: Solidity for managing decentralized transactions related to gift exchanges

## Smart Contract / Core Logic

Here’s a simplified example of how you can utilize Zama libraries within a smart contract interface for encrypting and decrypting gift amounts:solidity
pragma solidity ^0.8.0;

import "zama-fhe-libraries.sol"; // Hypothetical import of Zama FHE libraries

contract WedGift {
    mapping(address => uint64) private encryptedAmounts;

    function sendGift(address recipient, uint64 encryptedAmount) public {
        encryptedAmounts[recipient] = encryptedAmount; // Store encrypted amount
    }

    function decryptGift() public view returns (uint64) {
        // Decrypt the amount for the sender
        return TFHE.decrypt(encryptedAmounts[msg.sender]);
    }
}

## Directory Structure

Here's a glimpse of the project structure for WedGift_Z:
WedGift_Z/
├── contracts/
│   └── WedGift.sol
├── src/
│   ├── components/
│   │   └── GiftForm.js
│   ├── App.js
│   └── index.js
├── server/
│   ├── routes/
│   │   └── giftRoutes.js
│   └── app.js
├── .env
└── package.json

## Installation & Setup

### Prerequisites

Before running WedGift_Z, make sure you have the following installed:

- Node.js
- npm or yarn
- MongoDB

### Step 1: Install Dependencies

Run the following commands in your terminal to install necessary packages:bash
npm install
npm install @zama/fhevm

Ensure you have the Zama library integrated into your project to leverage FHE capabilities seamlessly.

### Step 2: Build and Run the Application

Once the dependencies are installed, use these commands to build and run the application:

- For the frontend:bash
  npm start

- For the backend:bash
  node server/app.js

- For smart contracts:bash
  npx hardhat compile

## Acknowledgements

We would like to extend our gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make this project possible. Their commitment to privacy and security has been instrumental in shaping WedGift_Z into a safe and trustworthy platform for users to share their blessings.

--- 

WedGift_Z not only embraces technology but also respects the emotional connection in gifting. By adopting advanced encryption measures, we ensure that every gift sent is not just a monetary value but a token of personal connection—safeguarded in every way possible.

