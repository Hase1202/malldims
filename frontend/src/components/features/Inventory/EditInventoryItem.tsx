import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemsApi } from '../../../lib/api';

const EditInventoryItem: React.FC = () => {
    const navigate = useNavigate();
    const { itemId } = useParams<{ itemId: string }>();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleDelete = async () => {
        if (!itemId) {
            setError('Item ID is missing');
            return;
        }

        try {
            setIsDeleting(true);
            const response = await itemsApi.delete(itemId);
            
            if (response.status === 'error') {
                throw new Error(response.message || 'Failed to delete item');
            }
            
            navigate('/inventory');
        } catch (error: any) {
            // Check if the error is due to associated transactions
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete item';
            setError(errorMessage);
            setIsDeleting(false);
            
            // If the error is not about transactions, close the delete dialog
            if (!errorMessage.includes('associated transactions')) {
                setShowDeleteDialog(false);
            }
        }
    };

    const handleClose = () => {
        setShowDeleteDialog(false);
        setError('');
    };

    return (
        <div className="edit-inventory-item">
            <h2>Edit Inventory Item</h2>
            {error && <div className="error-message">{error}</div>}
            <button 
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
            >
                Delete Item
            </button>
            {showDeleteDialog && (
                <div className="delete-dialog">
                    <p>Are you sure you want to delete this item?</p>
                    <button onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button onClick={handleClose} disabled={isDeleting}>
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};

export default EditInventoryItem; 