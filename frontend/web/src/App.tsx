import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface WeddingGift {
  id: string;
  name: string;
  encryptedAmount: string;
  publicValue1: number;
  publicValue2: number;
  description: string;
  creator: string;
  timestamp: number;
  isVerified: boolean;
  decryptedValue: number;
  blessing: string;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<WeddingGift[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingGift, setCreatingGift] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newGiftData, setNewGiftData] = useState({ name: "", amount: "", blessing: "", coupleName: "" });
  const [selectedGift, setSelectedGift] = useState<WeddingGift | null>(null);
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [stats, setStats] = useState({ totalGifts: 0, totalAmount: 0, verifiedGifts: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        console.error('FHEVM initialization failed:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const giftsList: WeddingGift[] = [];
      let totalAmount = 0;
      let verifiedCount = 0;

      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          const gift: WeddingGift = {
            id: businessId,
            name: businessData.name,
            encryptedAmount: businessId,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            description: businessData.description,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            blessing: businessData.description
          };
          giftsList.push(gift);
          
          if (businessData.isVerified) {
            verifiedCount++;
            totalAmount += Number(businessData.decryptedValue) || 0;
          }
        } catch (e) {
          console.error('Error loading gift data:', e);
        }
      }
      
      setGifts(giftsList);
      setStats({
        totalGifts: giftsList.length,
        totalAmount,
        verifiedGifts: verifiedCount
      });
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createGift = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingGift(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted gift with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const amountValue = parseInt(newGiftData.amount) || 0;
      const businessId = `gift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const encryptedResult = await encrypt(contractAddress, address, amountValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newGiftData.coupleName,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        0,
        0,
        newGiftData.blessing
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Gift created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewGiftData({ name: "", amount: "", blessing: "", coupleName: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingGift(false); 
    }
  };

  const decryptGift = async (giftId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const giftData = await contractRead.getBusinessData(giftId);
      if (giftData.isVerified) {
        const storedValue = Number(giftData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Gift already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(giftId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(giftId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Gift decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Gift is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const testContract = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Contract test failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderStats = () => (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon">🎁</div>
        <div className="stat-content">
          <h3>{stats.totalGifts}</h3>
          <p>Total Gifts</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <h3>{stats.totalAmount}</h3>
          <p>Total Amount</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">✅</div>
        <div className="stat-content">
          <h3>{stats.verifiedGifts}</h3>
          <p>Verified</p>
        </div>
      </div>
    </div>
  );

  const renderFAQ = () => (
    <div className="faq-section">
      <h3>Frequently Asked Questions</h3>
      <div className="faq-list">
        <div className="faq-item">
          <h4>How does FHE protect my gift amount?</h4>
          <p>Your gift amount is encrypted using Zama FHE technology, ensuring only the wedding couple can decrypt it while keeping the amount private from everyone else.</p>
        </div>
        <div className="faq-item">
          <h4>When can the couple see the gift amount?</h4>
          <p>The couple can decrypt and verify the gift amount at any time using their wallet. The amount remains encrypted until they choose to decrypt it.</p>
        </div>
        <div className="faq-item">
          <h4>Is my blessing message private?</h4>
          <p>Blessing messages are stored publicly on-chain. Only the gift amount is encrypted using FHE technology.</p>
        </div>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>WedGift 🔐</h1>
            <p>Private Wedding Gifts with FHE</p>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="welcome-content">
            <div className="welcome-icon">💍</div>
            <h2>Welcome to Private Wedding Gifting</h2>
            <p>Send encrypted gifts with complete privacy using Zama FHE technology</p>
            <div className="feature-grid">
              <div className="feature">
                <span>🔐</span>
                <p>Amount Encryption</p>
              </div>
              <div className="feature">
                <span>💝</span>
                <p>Private Blessings</p>
              </div>
              <div className="feature">
                <span>⚡</span>
                <p>Instant Verification</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your wedding gifts</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading wedding gifts...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>WedGift 🔐</h1>
          <p>Private Wedding Gifts</p>
        </div>
        
        <div className="header-actions">
          <button className="test-btn" onClick={testContract}>
            Test Contract
          </button>
          <button className="faq-btn" onClick={() => setShowFAQ(!showFAQ)}>
            FAQ
          </button>
          <button className="create-btn" onClick={() => setShowCreateModal(true)}>
            Send Gift
          </button>
          <ConnectButton />
        </div>
      </header>
      
      <div className="main-content">
        {showFAQ && renderFAQ()}
        
        <div className="dashboard-section">
          <h2>Wedding Gift Dashboard</h2>
          {renderStats()}
        </div>
        
        <div className="gifts-section">
          <div className="section-header">
            <h2>Recent Gifts</h2>
            <button onClick={loadData} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          
          <div className="gifts-grid">
            {gifts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎁</div>
                <p>No gifts yet</p>
                <button onClick={() => setShowCreateModal(true)}>
                  Send First Gift
                </button>
              </div>
            ) : (
              gifts.map((gift, index) => (
                <div className="gift-card" key={index}>
                  <div className="gift-header">
                    <h3>{gift.name}</h3>
                    <span className={`status ${gift.isVerified ? 'verified' : 'encrypted'}`}>
                      {gift.isVerified ? '✅ Verified' : '🔐 Encrypted'}
                    </span>
                  </div>
                  <div className="gift-content">
                    <p className="blessing">{gift.blessing}</p>
                    <div className="gift-meta">
                      <span>From: {gift.creator.substring(0, 6)}...{gift.creator.substring(38)}</span>
                      <span>{new Date(gift.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="gift-actions">
                    <button 
                      onClick={async () => {
                        const amount = await decryptGift(gift.id);
                        if (amount !== null) {
                          setDecryptedAmount(amount);
                        }
                      }}
                      disabled={isDecrypting}
                      className={`decrypt-btn ${gift.isVerified ? 'verified' : ''}`}
                    >
                      {isDecrypting ? 'Decrypting...' : gift.isVerified ? `Amount: ${gift.decryptedValue}` : 'Decrypt Amount'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Send Wedding Gift</h2>
              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="fhe-notice">
                <strong>FHE 🔐 Encryption Active</strong>
                <p>Gift amount will be encrypted with Zama FHE technology</p>
              </div>
              
              <div className="form-group">
                <label>Couple's Name *</label>
                <input 
                  type="text"
                  value={newGiftData.coupleName}
                  onChange={(e) => setNewGiftData({...newGiftData, coupleName: e.target.value})}
                  placeholder="Enter couple's name"
                />
              </div>
              
              <div className="form-group">
                <label>Gift Amount (Integer) *</label>
                <input 
                  type="number"
                  value={newGiftData.amount}
                  onChange={(e) => setNewGiftData({...newGiftData, amount: e.target.value})}
                  placeholder="Enter gift amount"
                  min="0"
                  step="1"
                />
                <div className="input-hint">FHE Encrypted Integer</div>
              </div>
              
              <div className="form-group">
                <label>Blessing Message *</label>
                <textarea 
                  value={newGiftData.blessing}
                  onChange={(e) => setNewGiftData({...newGiftData, blessing: e.target.value})}
                  placeholder="Enter your blessing message"
                  rows={3}
                />
                <div className="input-hint">Publicly visible blessing</div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button 
                onClick={createGift}
                disabled={creatingGift || isEncrypting || !newGiftData.coupleName || !newGiftData.amount || !newGiftData.blessing}
              >
                {creatingGift || isEncrypting ? 'Encrypting...' : 'Send Encrypted Gift'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <span className="toast-icon">
              {transactionStatus.status === "pending" && "⏳"}
              {transactionStatus.status === "success" && "✅"}
              {transactionStatus.status === "error" && "❌"}
            </span>
            {transactionStatus.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

