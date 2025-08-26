import { useState, useEffect, useRef } from 'react';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertItem } from './Alerts';
import Sidebar from '../../components/common/Sidebar';
import Toast from '../../components/common/Toast';

export default function GenerateRequisitionList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<AlertItem[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [requestedQuantities, setRequestedQuantities] = useState<Record<number, number>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<number, string>>({});
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Get selected items from location state
  useEffect(() => {
    if (location.state?.selectedItems) {
      setSelectedItems(location.state.selectedItems);
      
      // Initialize requested quantities with threshold or current quantity
      const initialQuantities: Record<number, number> = {};
      location.state.selectedItems.forEach((item: AlertItem) => {
        if (item.isPendingDue && item.pendingTransaction) {
          // For pending due, use the requested quantity from the pending transaction
          initialQuantities[item.item_id] = item.pendingTransaction.requested_quantity;
        } else {
          // For low stock: if quantity is 0, set to threshold value; otherwise, threshold - quantity
          initialQuantities[item.item_id] = item.quantity === 0 
            ? item.threshold_value 
            : item.threshold_value - item.quantity;
        }
      });
      setRequestedQuantities(initialQuantities);
    } else {
      // If no items are selected, go back to alerts page
      navigate('/alerts');
    }
  }, [location.state, navigate]);

  // Handle quantity change
  const handleQuantityChange = (itemId: number, value: string) => {
    // Clear any existing error for this item
    setQuantityErrors(prev => ({
      ...prev,
      [itemId]: ''
    }));

    // Handle empty value
    if (value === '') {
      setRequestedQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[itemId];
        return newQuantities;
      });
      return;
    }

    // Convert to number and validate
    const numValue = Number(value);

    // Check if it's not a valid number
    if (isNaN(numValue)) {
      setQuantityErrors(prev => ({
        ...prev,
        [itemId]: 'Please enter a valid number'
      }));
      return;
    }

    // Check if it's zero or negative
    if (numValue <= 0) {
      setQuantityErrors(prev => ({
        ...prev,
        [itemId]: 'Quantity must be greater than 0'
      }));
      return;
    }

    // Convert decimal to integer
    const intValue = Math.floor(numValue);
    if (intValue !== numValue) {
      setQuantityErrors(prev => ({
        ...prev,
        [itemId]: 'Decimal values will be rounded down'
      }));
    }

    // Update the quantity with the valid integer value
    setRequestedQuantities(prev => ({
      ...prev,
      [itemId]: intValue
    }));
  };

  // Group items by brand
  const getItemsByBrand = () => {
    const grouped: Record<string, AlertItem[]> = {};
    
    selectedItems.forEach(item => {
      if (!grouped[item.brand_name]) {
        grouped[item.brand_name] = [];
      }
      grouped[item.brand_name].push(item);
    });
    
    return grouped;
  };

  // Handle print
  const handlePrint = () => {
    if (printContainerRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const printContent = printContainerRef.current.innerHTML;
        printWindow.document.write(`
          <html>
            <head>
              <title>Requisition List</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1, h2 { margin-bottom: 10px; }
                .brand-section { margin-bottom: 30px; }
                .header { margin-bottom: 20px; }
                .quantity-col { width: 100px; }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
    
    setToastType('success');
    setToastMessage('Print preview opened');
    setShowToast(true);
  };

  // Handle export as CSV
  const handleExportCSV = () => {
    // Create CSV content with headers matching table order
    let csvContent = 'Item,Model No.,Brand,Stock on Hand,Threshold,Due Date,Requested Quantity\n';
    
    const itemsByBrand = getItemsByBrand();
    Object.entries(itemsByBrand).forEach(([brandName, items]) => {
      items.forEach(item => {
        const row = [
          item.item_name,
          item.model_number,
          brandName,
          item.quantity,
          item.threshold_value,
          getDueDate(),
          requestedQuantities[item.item_id] || 0
        ].map(value => `"${value}"`).join(',');
        
        csvContent += row + '\n';
      });
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    // Format date and time for filename
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const dateTimeString = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    link.setAttribute('download', `lowtemp_requisition_list_${dateTimeString}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setToastType('success');
    setToastMessage('Export complete');
    setShowToast(true);
  };

  // Get due date (7 days from now) in formatted string
  const getDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Handle back button click
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8 overflow-y-auto pb-12 lg:ml-64">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center cursor-pointer gap-2 text-sm text-[#646464] hover:text-[#3d3d3d] mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
        
        {/* Header */}
        <div className="flex flex-col space-y-1 mb-6">
          <h1 className="text-2xl font-bold text-[#2C2C2C]">Generate Requisition List</h1>
          <p className="text-[#646464]">Review and export requisition list</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end mb-6">
          <div className="flex space-x-3">
            <button
              onClick={handlePrint}
              className="flex cursor-pointer items-center gap-2 py-2 px-3.5 bg-white border-[1.5px] border-[#EBEAEA] rounded-lg hover:bg-gray-50 text-sm font-medium text-[#2C2C2C] transition-all active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 py-2 px-3.5 bg-[#E6E6FE] border-[1.5px] border-[#DADAF3] rounded-lg text-[#0504AA] font-medium text-sm hover:bg-opacity-90 cursor-pointer active:scale-95 duration-50 transition-all ease-out"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Requisition List Content */}
        <div ref={printContainerRef} className="bg-white rounded-lg border border-[#EBEAEA] p-6 lg:p-8">
          {/* Header */}
          <div className="header mb-8">
            <h1 className="text-xl font-bold text-[#2C2C2C]">Requisition List</h1>
            <p className="text-[#6F6F6F] mt-2">Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9]">
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Item</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Model No.</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Brand</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Stock on Hand</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Threshold</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium">Due Date</th>
                <th className="border border-[#EBEAEA] px-4 py-3 text-left text-[#2C2C2C] font-medium quantity-col">Requested Quantity</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map(item => (
                <tr key={item.item_id} className="hover:bg-[#F9F9F9]">
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">{item.item_name}</td>
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">{item.model_number}</td>
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">{item.brand_name}</td>
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">
                    <span className={item.quantity === 0 ? "text-red-600 font-medium" : ""}>{item.quantity}</span>
                  </td>
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">{item.threshold_value}</td>
                  <td className="border border-[#EBEAEA] px-4 py-3 text-[#2C2C2C]">{getDueDate()}</td>
                  <td className="border border-[#EBEAEA] px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        value={requestedQuantities[item.item_id] || ''}
                        onChange={(e) => handleQuantityChange(item.item_id, e.target.value)}
                        className={`w-full p-2 border-[1.5px] rounded-lg text-sm text-[#2C2C2C] placeholder:text-[#6F6F6F] focus:outline-none transition-colors duration-200 ${
                          quantityErrors[item.item_id] 
                            ? 'border-[#D3465C] focus:border-[#D3465C]' 
                            : 'border-[#EBEAEA] focus:border-[#DADAF3]'
                        }`}
                        placeholder="Enter quantity"
                      />
                      {quantityErrors[item.item_id] && (
                        <span className="text-[#D3465C] text-xs">{quantityErrors[item.item_id]}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <Toast
          title={toastType === 'success' && toastMessage === 'Export complete' ? 'Export complete' : toastMessage}
          message={toastType === 'success' && toastMessage === 'Export complete' ? 'Requisition list has been downloaded' : undefined}
          type={toastType}
          duration={3000}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
