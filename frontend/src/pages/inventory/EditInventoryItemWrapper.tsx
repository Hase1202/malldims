import { useParams, useNavigate, Navigate } from 'react-router-dom';
import EditInventoryItemPage from './EditInventoryItem';
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';

export default function EditInventoryItemWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  
  if (isSales(user)) return <Navigate to="/inventory" replace />;
  
  if (!id) {
    return <div>Item ID is required</div>;
  }
  
  const handleClose = () => {
    navigate(`/inventory/${id}`);
  };
  
  return <EditInventoryItemPage itemId={id} onClose={handleClose} />;
}