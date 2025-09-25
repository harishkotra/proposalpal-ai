import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer'; 
import VotePage from './pages/VotePage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import BillingPage from './pages/BillingPage';
import FAQPage from './pages/FAQPage'; 

function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<VotePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/faq" element={<FAQPage />} /> 
        </Routes>
      </main>
      <Footer />
    </>
  );
}
export default App;