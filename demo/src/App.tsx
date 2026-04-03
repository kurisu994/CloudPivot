import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MaterialList from './pages/MaterialList';
import PurchaseOrderList from './pages/PurchaseOrderList';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="materials" element={<MaterialList />} />
          <Route path="purchase-orders" element={<PurchaseOrderList />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
