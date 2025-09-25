import { Github } from 'lucide-react';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p>
                    Built by <strong>Harish Kotra</strong> for the Cardano Community. Supported by <strong>Intersect MBO</strong>.
                </p>
                <a 
                    href="https://github.com/harishkotra/proposalpal-ai" // <-- IMPORTANT: Change this URL
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="github-link"
                >
                    <Github size={18} />
                    <span>Contribute on GitHub</span>
                </a>
            </div>
        </footer>
    );
}