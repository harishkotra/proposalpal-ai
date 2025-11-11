import { Github } from 'lucide-react';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p>
                    Built by <strong>Harish Kotra</strong> for the Cardano Community.
                </p>
                <a 
                    href="https://github.com/harishkotra/proposalpal-ai"
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