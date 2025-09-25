import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './FAQPage.css';

// Reusable Accordion Item Component
const AccordionItem = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="accordion-item">
            <button className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{question}</span>
                <ChevronDown className={`accordion-icon ${isOpen ? 'open' : ''}`} />
            </button>
            <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                <div className="accordion-content-inner">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Main FAQ Page Component
export default function FAQPage() {
    return (
        <div className="faq-container">
            <div className="hero-section">
                <h1>Frequently Asked Questions</h1>
                <p>Find answers to common questions about ProposalPal AI's features.</p>
            </div>

            <div className="faq-list">
                <AccordionItem question="How do AI summary credits work?">
                    <p>Every new user receives <strong>500 free credits</strong> upon connecting their wallet for the first time. Each time you request an AI summary for a CIP, one credit is used. This system allows us to manage the computational costs of running the AI model while providing a generous free tier.</p>
                </AccordionItem>

                <AccordionItem question="How can I get more credits?">
                    <p>Once you run out of free credits, you can easily purchase more. Navigate to the "Billing" page, where you can buy a bundle of 1,500 additional credits for a small fee in ADA. The transaction is handled securely through your connected Cardano wallet.</p>
                </AccordionItem>

                <AccordionItem question="Is the AI private? What is Gaia Node?">
                    <p>Your privacy is our priority. We use <strong>Gaia Node</strong>, a privacy-first, decentralized infrastructure for AI. Unlike centralized services, your requests and data are not logged or used for training models. Gaia Node allows us to bring you powerful AI summaries without compromising your privacy.</p>
                </AccordionItem>

                <AccordionItem question="How does the Leaderboard work?">
                    <p>The Leaderboard is a fun way to recognize active community members. You earn <strong>1 point for every vote</strong> you cast on a CIP. Your total points determine your rank. It's designed to encourage participation and gauge community sentiment on various proposals.</p>
                </AccordionItem>

                <AccordionItem question="What is the Governance Dashboard?">
                    <p>The Dashboard is your personal hub for tracking your governance activity on ProposalPal AI. It shows your total votes cast, your governance points, your current leaderboard rank, and a detailed history of all your past votes.</p>
                </AccordionItem>

                <AccordionItem question="Where is my voting data stored?">
                    <p>Your voting history is stored in a lightweight, private database linked to your wallet address. This allows us to provide features like the Dashboard and prevent double-voting. The votes themselves are recorded on the Cardano blockchain as metadata in a transaction, but the AI summaries and credit information are managed off-chain for efficiency.</p>
                </AccordionItem>

                <AccordionItem question="Are the votes on ProposalPal AI official Cardano governance votes?">
                    <p><strong>No.</strong> It's important to understand that votes cast within this application are for community engagement and sentiment analysis. They are <strong>not</strong> official, on-chain governance votes that directly influence the Cardano protocol. They serve as a valuable tool for discussion and community feedback.</p>
                </AccordionItem>

                <AccordionItem question="Why should I vote here if it's not official?">
                    <p>Your participation helps create a snapshot of community opinion, which can be a powerful tool to inform developers, researchers, and official voting delegates (like those in Project Catalyst). By making it easy to understand and vote on complex CIPs, we aim to foster a more informed and engaged Cardano community.</p>
                </AccordionItem>
            </div>
        </div>
    );
}