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
  publicBlessing: string;
  publicValue1: number;
  publicValue2: number;
  timestamp: number;
  creator: string;
  isVerified?: boolean;
  decryptedValue?: number;
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
  const [newGiftData, setNewGiftData] = useState({ name: "", amount: "", blessing: "" });
  const [selectedGift, setSelectedGift] = useState<WeddingGift | null>(null);
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          giftsList.push({
            id: businessId,
            name: businessData.name,
            encryptedAmount: businessId,
            publicBlessing: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setGifts(giftsList);
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
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted gift..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const amountValue = parseInt(newGiftData.amount) || 0;
      const businessId = `gift-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, amountValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newGiftData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newGiftData.blessing) || 0,
        0,
        "Wedding Gift"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Gift created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewGiftData({ name: "", amount: "", blessing: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingGift(false); 
    }
  };

  const decryptGift = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) return null;
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Gift amount decrypted!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredGifts = gifts.filter(gift => 
    gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gift.creator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalGifts = gifts.length;
  const verifiedGifts = gifts.filter(g => g.isVerified).length;
  const totalBlessing = gifts.reduce((sum, g) => sum + g.publicValue1, 0);

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>💍 Private Wedding Gift</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">💒</div>
            <h2>Welcome to Private Wedding Gifts</h2>
            <p>Connect your wallet to send encrypted gifts with FHE protection</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE System...</p>
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
          <h1>💒 Private Wedding Gift</h1>
          <p>FHE Encrypted Red Packets</p>
        </div>
        
        <div className="header-actions">
          <button onClick={() => setShowFAQ(true)} className="faq-btn">FAQ</button>
          <button onClick={checkAvailability} className="check-btn">Check Contract</button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">+ Send Gift</button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-panels">
          <div className="stat-panel">
            <h3>Total Gifts</h3>
            <div className="stat-value">{totalGifts}</div>
          </div>
          <div className="stat-panel">
            <h3>Verified</h3>
            <div className="stat-value">{verifiedGifts}</div>
          </div>
          <div className="stat-panel">
            <h3>Total Blessing</h3>
            <div className="stat-value">{totalBlessing}</div>
          </div>
        </div>

        <div className="search-section">
          <input 
            type="text"
            placeholder="Search gifts by name or creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="gifts-list">
          {filteredGifts.length === 0 ? (
            <div className="no-gifts">
              <p>No gifts found</p>
              <button onClick={() => setShowCreateModal(true)} className="create-btn">
                Send First Gift
              </button>
            </div>
          ) : filteredGifts.map((gift, index) => (
            <div 
              className={`gift-item ${selectedGift?.id === gift.id ? "selected" : ""}`} 
              key={index}
              onClick={() => setSelectedGift(gift)}
            >
              <div className="gift-header">
                <span className="gift-name">{gift.name}</span>
                <span className={`status ${gift.isVerified ? "verified" : "pending"}`}>
                  {gift.isVerified ? "✅ Verified" : "🔒 Encrypted"}
                </span>
              </div>
              <div className="gift-meta">
                <span>Blessing: {gift.publicValue1}/10</span>
                <span>{new Date(gift.timestamp * 1000).toLocaleDateString()}</span>
              </div>
              <div className="gift-creator">From: {gift.creator.substring(0, 6)}...{gift.creator.substring(38)}</div>
            </div>
          ))}
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateGift 
          onSubmit={createGift} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingGift} 
          giftData={newGiftData} 
          setGiftData={setNewGiftData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedGift && (
        <GiftDetailModal 
          gift={selectedGift} 
          onClose={() => { 
            setSelectedGift(null); 
            setDecryptedAmount(null); 
          }} 
          decryptedAmount={decryptedAmount} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptGift={() => decryptGift(selectedGift.id)}
        />
      )}
      
      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateGift: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  giftData: any;
  setGiftData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, giftData, setGiftData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const intValue = value.replace(/[^\d]/g, '');
      setGiftData({ ...giftData, [name]: intValue });
    } else {
      setGiftData({ ...giftData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-gift-modal">
        <div className="modal-header">
          <h2>Send Encrypted Wedding Gift</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Protection</strong>
            <p>Gift amount will be encrypted with Zama FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Your Name *</label>
            <input 
              type="text" 
              name="name" 
              value={giftData.name} 
              onChange={handleChange} 
              placeholder="Enter your name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Gift Amount (Integer) *</label>
            <input 
              type="number" 
              name="amount" 
              value={giftData.amount} 
              onChange={handleChange} 
              placeholder="Enter gift amount..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted</div>
          </div>
          
          <div className="form-group">
            <label>Blessing Level (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="blessing" 
              value={giftData.blessing} 
              onChange={handleChange} 
              placeholder="Enter blessing level..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !giftData.name || !giftData.amount || !giftData.blessing} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Send Gift"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GiftDetailModal: React.FC<{
  gift: WeddingGift;
  onClose: () => void;
  decryptedAmount: number | null;
  isDecrypting: boolean;
  decryptGift: () => Promise<number | null>;
}> = ({ gift, onClose, decryptedAmount, isDecrypting, decryptGift }) => {
  const handleDecrypt = async () => {
    if (decryptedAmount !== null) return;
    await decryptGift();
  };

  return (
    <div className="modal-overlay">
      <div className="gift-detail-modal">
        <div className="modal-header">
          <h2>Gift Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="gift-info">
            <div className="info-item">
              <span>From:</span>
              <strong>{gift.name}</strong>
            </div>
            <div className="info-item">
              <span>Wallet:</span>
              <strong>{gift.creator.substring(0, 6)}...{gift.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date:</span>
              <strong>{new Date(gift.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Blessing Level:</span>
              <strong>{gift.publicValue1}/10</strong>
            </div>
          </div>
          
          <div className="encrypted-section">
            <h3>Encrypted Gift Amount</h3>
            <div className="amount-display">
              {gift.isVerified ? 
                `$${gift.decryptedValue} (Verified)` : 
                decryptedAmount !== null ? 
                `$${decryptedAmount} (Decrypted)` : 
                "🔒 FHE Encrypted"
              }
            </div>
            
            <button 
              className={`decrypt-btn ${(gift.isVerified || decryptedAmount !== null) ? 'decrypted' : ''}`}
              onClick={handleDecrypt} 
              disabled={isDecrypting}
            >
              {isDecrypting ? "Decrypting..." : 
               gift.isVerified ? "✅ Verified" : 
               decryptedAmount !== null ? "🔓 Decrypted" : 
               "🔓 Decrypt Amount"}
            </button>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="faq-modal">
        <div className="modal-header">
          <h2>FAQ - Private Wedding Gifts</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="faq-item">
            <h3>How does FHE encryption work?</h3>
            <p>Your gift amount is encrypted using Fully Homomorphic Encryption, allowing secure computation while keeping the amount private.</p>
          </div>
          
          <div className="faq-item">
            <h3>Who can see the gift amount?</h3>
            <p>Only the wedding couple can decrypt and see the actual amount using their private key.</p>
          </div>
          
          <div className="faq-item">
            <h3>Is this secure?</h3>
            <p>Yes, FHE ensures that gift amounts remain confidential throughout the process.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;