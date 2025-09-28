# Debugging 400 Errors - Step-by-Step Guide

## 🔍 What is a 400 Error?

A **400 Bad Request** error means the server cannot process your request because:
- Required data is missing
- Data format is incorrect
- Validation rules are not met
- Field values are invalid

## 🚨 Quick Debug Steps

### Step 1: Enable Debug Mode

#### Frontend Debug (Browser Console)
1. **Open Browser Dev Tools** (F12 or right-click → Inspect)
2. **Go to Console tab**
3. **Try your transaction** - you'll now see detailed logs:

```
🔍 Fetching batches for item 1...
📦 Batch API response: {...}
📤 Sending transaction data: {...}
🚨 Transaction Creation Error: {...}
❌ HTTP 400 Error Response: {...}
```

#### Backend Debug (Terminal)
1. **Check your backend terminal** where `python manage.py runserver` is running
2. **Look for debug output** like:
```
🔍 TransactionCreateSerializer.validate() called
📋 Data to validate: {...}
❌ Validation failed: {...}
```

### Step 2: Use the Transaction Debugger

I created a debugging tool for you. Create this component and use it:

**File: `frontend/src/components/demo/TransactionDebugger.tsx`** (already provided above)

**Usage:**
1. Navigate to the TransactionDebugger page
2. Fill out the form step by step
3. See exactly what data is being sent
4. Get detailed error information

### Step 3: Common 400 Error Causes & Fixes

#### ❌ Error: "Customer information is required"
**Cause:** Missing customer name for outgoing transactions
**Fix:**
```javascript
// Make sure customer_name is not empty
customer_name: "Test Customer"  // ✅ Good
customer_name: ""              // ❌ Bad
```

#### ❌ Error: "Pricing tier is required"
**Cause:** Missing pricing_tier in transaction items
**Fix:**
```javascript
// Each item must have pricing_tier
items: [{
  item: 1,
  quantity_change: -5,
  pricing_tier: "DD",  // ✅ Required!
  unit_price: 80
}]
```

#### ❌ Error: "Valid unit price is required"
**Cause:** unit_price is 0, negative, or missing
**Fix:**
```javascript
// Ensure unit_price is positive
unit_price: 80.00,  // ✅ Good
unit_price: 0,      // ❌ Bad
unit_price: null,   // ❌ Bad
```

#### ❌ Error: "Item with ID X does not exist"
**Cause:** Invalid item ID
**Fix:**
1. Check if item exists in database
2. Use correct item_id from dropdown

#### ❌ Error: "Batch with ID X does not exist"
**Cause:** Invalid batch_id when batch is required
**Fix:**
1. Don't send batch_id if no batch selected
2. Verify batch exists and has available quantity

#### ❌ Error: "Insufficient quantity in batch"
**Cause:** Trying to sell more than available in batch
**Fix:**
```javascript
// Check available quantity first
if (requestedQuantity <= batch.remaining_quantity) {
  // ✅ OK to proceed
}
```

## 🛠️ Detailed Debugging Process

### 1. Check Request Data

**In Browser Console, look for:**
```
📤 Sending transaction data: {
  "transaction_type": "OUTGOING",
  "customer_name": "Test Customer",
  "items": [{
    "item": 1,
    "quantity_change": -5,
    "pricing_tier": "DD",
    "unit_price": 80,
    "total_price": 400
  }]
}
```

**Verify each field:**
- ✅ `transaction_type` is "OUTGOING"
- ✅ `customer_name` is not empty
- ✅ `items` array has at least one item
- ✅ Each item has `item`, `quantity_change`, `pricing_tier`, `unit_price`

### 2. Check Backend Validation

**In Backend Terminal, look for:**
```
🔍 TransactionCreateSerializer.validate() called
📋 Data to validate: {...}
❌ Pricing tier is required for item 1 in outgoing transactions
```

**Common validation errors:**
- Missing required fields
- Invalid field values
- Business rule violations
- Database constraint violations

### 3. Check Database State

**Run in Django shell:**
```bash
python manage.py shell
```

```python
# Check if item exists
from inventory.models import Item, ItemBatch
item = Item.objects.filter(item_id=1).first()
print(f"Item exists: {item is not None}")

# Check if batches exist
batches = ItemBatch.objects.filter(item_id=1, remaining_quantity__gt=0)
print(f"Available batches: {batches.count()}")
for batch in batches:
    print(f"  Batch {batch.batch_number}: {batch.remaining_quantity} available")

# Check user cost tier
from inventory.models import Account
user = Account.objects.filter(username="your_username").first()
print(f"User cost tier: {user.cost_tier if user else 'User not found'}")
```

## 🔧 Step-by-Step Fix Process

### If You're Getting 400 Errors:

#### Step 1: Create Test Data
```bash
cd agmall-dims/backend
python manage.py create_test_batches
```

#### Step 2: Set User Cost Tier
```bash
python manage.py shell
```
```python
from inventory.models import Account
user = Account.objects.get(username="your_username")
user.cost_tier = "PD"  # Set to Provincial Distributor
user.save()
print(f"User cost tier set to: {user.cost_tier}")
```

#### Step 3: Test with Simple Data
Use the TransactionDebugger with:
- **Customer:** "Test Customer"
- **Item:** Select any item from dropdown
- **Quantity:** 5
- **Pricing Tier:** Select any allowed tier
- **Batch:** Select available batch (if any)

#### Step 4: Check the Request/Response
Look at the debug output to see exactly what's being sent and what error is returned.

## 📋 Checklist for Working Transactions

Before submitting a transaction, verify:

### Data Requirements:
- [ ] Customer name is provided and not empty
- [ ] At least one item is selected
- [ ] Each item has a valid item ID
- [ ] Each item has quantity > 0
- [ ] Each item has a pricing tier
- [ ] Each item has unit_price > 0
- [ ] User is logged in and authenticated
- [ ] User has appropriate cost_tier set

### Optional but Recommended:
- [ ] Batch is selected (if available)
- [ ] Batch has sufficient quantity
- [ ] Total price is calculated correctly

### Backend Requirements:
- [ ] Item exists in database
- [ ] Batch exists (if batch_id provided)
- [ ] User has permission to sell at selected tier
- [ ] Customer will be created/found successfully

## 🎯 Expected Working Request

Here's what a successful request should look like:

```json
{
  "transaction_type": "OUTGOING",
  "transaction_status": "Pending",
  "customer_name": "Test Customer",
  "items": [
    {
      "item": 1,
      "quantity_change": -5,
      "pricing_tier": "DD",
      "unit_price": 80.0,
      "total_price": 400.0,
      "batch_id": 1
    }
  ]
}
```

## 🆘 Still Getting 400 Errors?

### Try This Minimal Test:

1. **Set up test data:**
```bash
python manage.py create_test_batches
```

2. **Login as test user:**
```
Username: pd_user
Password: password123
```

3. **Create transaction with:**
- Customer: "ABC Beauty Store" (created by test script)
- Item: "Lipstick - Red" (created by test script)
- Quantity: 2
- Pricing tier: DD (PD user can sell at DD)
- Batch: Select any available batch

4. **If this fails, share:**
- Browser console output
- Backend terminal output
- The exact request/response from TransactionDebugger

This should work 100% with the test data! If it doesn't, there's likely a setup or configuration issue we need to address.

## 💡 Pro Tips

1. **Always check browser console** - it shows the exact error details
2. **Use the TransactionDebugger** - it shows request/response data clearly
3. **Start with test data** - don't use production data for debugging
4. **Check one thing at a time** - validate each field individually
5. **Compare working vs failing requests** - spot the differences

The 400 errors are usually easy to fix once you see exactly what data is being rejected! 🚀
