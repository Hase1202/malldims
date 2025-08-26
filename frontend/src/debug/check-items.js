// Debug script to examine item availability status logic
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Function to fetch all items and print their status
async function checkItemAvailabilityLogic() {
  try {
    console.log(`Fetching items from ${API_BASE_URL}/items/`);
    const response = await fetch(`${API_BASE_URL}/items/`);
    const data = await response.json();
    
    // Log raw response 
    console.log('Raw API response:', data);
    
    // Extract items (handle both array and paginated responses)
    const items = Array.isArray(data) ? data : data.results || [];
    console.log(`Found ${items.length} items`);
    
    // Check availability status versus quantity and thresholds
    console.log('\nAVAILABILITY STATUS ANALYSIS:');
    console.log('-------------------------------');
    
    const statusCounts = {
      'Out of Stock': 0,
      'Low Stock': 0,
      'In Stock': 0,
      'Other': 0
    };
    
    // Check each item
    items.forEach(item => {
      const status = item.availability_status;
      const quantity = item.quantity;
      const threshold = item.threshold_value;
      
      // Count by status
      if (status in statusCounts) {
        statusCounts[status]++;
      } else {
        statusCounts['Other']++;
      }
      
      // Check if status matches quantity logic
      let expectedStatus = 'Unknown';
      if (quantity === 0) {
        expectedStatus = 'Out of Stock';
      } else if (quantity < threshold) {
        expectedStatus = 'Low Stock';
      } else {
        expectedStatus = 'In Stock';
      }
      
      // Log mismatches
      if (status !== expectedStatus) {
        console.log(`MISMATCH: Item ${item.item_id} (${item.item_name})`);
        console.log(`  Current status: ${status}`);
        console.log(`  Expected status: ${expectedStatus}`);
        console.log(`  Quantity: ${quantity}, Threshold: ${threshold}`);
        console.log('---');
      }
    });
    
    // Log summary
    console.log('\nSTATUS COUNTS:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count} items`);
    });
    
    // Check out of stock items specifically
    console.log('\nOUT OF STOCK ITEMS:');
    const outOfStockItems = items.filter(item => item.availability_status === 'Out of Stock');
    outOfStockItems.forEach(item => {
      console.log(`Item: ${item.item_name}, Quantity: ${item.quantity}, Threshold: ${item.threshold_value}`);
    });
    
  } catch (error) {
    console.error('Error checking items:', error);
  }
}

// Run the check
checkItemAvailabilityLogic();

export default checkItemAvailabilityLogic; 