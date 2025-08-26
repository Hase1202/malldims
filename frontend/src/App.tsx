import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; 
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages - Only import existing files
import LoginPage from './pages/auth/Login';
import HomePage from './pages/home/Home';
import InventoryPage from './pages/inventory/Inventory';
import TransactionsPage from './pages/transactions/Transactions';
import AlertsPage from './pages/alerts/Alerts';
import SettingsPage from './pages/settings/Settings';
import AddInventoryItemPage from './pages/inventory/AddItem';
import InventoryItemDetails from './pages/inventory/InventoryItemDetails';
import BrandsPage from './pages/brands/BrandsPage';
import ItemPricingPage from './pages/inventory/ItemPricingPage';
import ItemBatchesPage from './pages/inventory/ItemBatchesPage';

// Customer Management Pages
import CustomersPage from './pages/customers/CustomersPage';
import AddCustomerPage from './pages/customers/AddCustomerPage';
import CustomerDetailsPage from './pages/customers/CustomerDetailsPage';
import EditCustomerPage from './pages/customers/EditCustomerPage';
import AddSpecialPricingPage from './pages/customers/AddSpecialPricingPage';

import './index.css';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              } />
            </Routes>
            <ToastContainer 
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<HomePage />} />        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/add" element={<AddInventoryItemPage />} />
        <Route path="/inventory/:id" element={<InventoryItemDetails />} />        <Route path="/inventory/:itemId/pricing" element={<ItemPricingPage />} />
        <Route path="/inventory/:itemId/batches" element={<ItemBatchesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
        
        {/* Customer Management Routes */}
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/add" element={<AddCustomerPage />} />
        <Route path="/customers/:id" element={<CustomerDetailsPage />} />
        <Route path="/customers/:id/edit" element={<EditCustomerPage />} />
        <Route path="/customers/:id/special-pricing/add" element={<AddSpecialPricingPage />} />
        
        <Route path="/brands/*" element={<BrandsPage />} />
        <Route path="/alerts/*" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;