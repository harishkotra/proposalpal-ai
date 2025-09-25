import { useState } from 'react';
import { useCredits } from '../context/CreditsContext';
import { useWallet, useAddress } from '@meshsdk/react';
import { Transaction } from '@meshsdk/core';
import axios from 'axios';
import { parseWalletError } from '../utils/errorParser';
import './BillingPage.css';

export default function BillingPage() {
    const { credits, loadingCredits, fetchCredits } = useCredits();
    const { wallet } = useWallet();
    const address = useAddress();
    const [isPaying, setIsPaying] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handlePayment = async () => {
        setIsPaying(true);
        setError('');
        setSuccessMessage('');
        try {
            const paymentAddress = import.meta.env.VITE_PAYMENT_WALLET_ADDRESS;
            const paymentAmount = import.meta.env.VITE_PAYMENT_AMOUNT;

            const tx = new Transaction({ initiator: wallet }).sendLovelace({ address: paymentAddress }, paymentAmount);
            const unsignedTx = await tx.build();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await wallet.submitTx(signedTx);

            await axios.post(`${import.meta.env.VITE_API_URL}/confirm-payment`, {
                walletAddress: address,
                txHash: txHash,
            });
            
            await fetchCredits(); // Refresh global credit state
            setSuccessMessage('Payment successful! 1500 credits have been added to your account.');

        } catch (err) {
            const friendlyError = parseWalletError(err);
            setError(friendlyError);
        } finally {
            setIsPaying(false);
        }
    };

    const adaAmount = parseInt(import.meta.env.VITE_PAYMENT_AMOUNT) / 1000000;

    return (
        <div className="billing-container">
            <div className="hero-section">
                <h1>Credits & Billing</h1>
                <p>Manage your AI summary credits and purchase more to continue participating.</p>
            </div>

            <div className="billing-grid">
                <div className="status-card">
                    <h3>Your Current Status</h3>
                    {loadingCredits ? <p>Loading credits...</p> : (
                        <div className="credit-details">
                            <p><strong>Remaining Credits:</strong> {credits.remaining}</p>
                            <p><strong>Consumed Credits:</strong> {credits.consumed}</p>
                            <p><strong>Total Available:</strong> {credits.total}</p>
                        </div>
                    )}
                </div>
                <div className="purchase-card">
                    <h3>Purchase More Credits</h3>
                    <p className="offer-text">Get <strong>1,500 more</strong> AI summaries</p>
                    <p className="price-text">for only <strong>{adaAmount} ADA</strong></p>
                    <button onClick={handlePayment} disabled={isPaying || !address} className="payment-button">
                        {isPaying ? 'Processing Payment...' : 'Purchase with Wallet'}
                    </button>
                    {error && <p className="billing-error">{error}</p>}
                    {successMessage && <p className="billing-success">{successMessage}</p>}
                </div>
            </div>
        </div>
    );
}