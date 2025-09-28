# Dynamic Transaction Pricing - Testing Guide

## Overview
This guide shows you exactly how to test the dynamic transaction pricing system that restricts users' selling price options based on their purchase tier.

## 🚀 Quick Start Testing

### Prerequisites
1. Backend server running on `http://127.0.0.1:8000`
2. Frontend running on `http://localhost:3000`
3. Database migrated with the new `cost_tier` field

### Step 1: Apply Database Migration
```bash
cd agmall-dims/backend
python manage.py migrate inventory
```

### Step 2: Create Test Users with Different Cost Tiers

#### Option A: Using Django Admin
1. Go to `http://127.0.0.1:8000/admin`
2. Navigate to `Accounts`
3. Create or edit users and set their `cost_tier` field:
   - User 1: `cost_tier = "PD"` (Provincial Distributor)
   - User 2: `cost_tier = "RS"` (Reseller)
   - User 3: `cost_tier = null` (Admin - no restrictions)

#### Option B: Using Django Shell
```python
python manage.py shell

from inventory.models import Account
from django.contrib.auth.hashers import make_password

# Create test users
user1 = Account.objects.create(
    username="pd_user",
    password=make_password("password123"),
    cost_tier="PD",
    role="Sales Rep",
    first_name="Provincial",
    last_name="User"
)

user2 = Account.objects.create(
    username="rs_user",
    password=make_password("password123"),
    cost_tier="RS",
    role="Sales Rep",
    first_name="Reseller",
    last_name="User"
)

user3 = Account.objects.create(
    username="admin_user",
    password=make_password("password123"),
    cost_tier=None,  # No restrictions
    role="Admin",
    first_name="Admin",
    last_name="User"
)
```

## 🧪 Test Scenarios

### Test 1: API Endpoints Testing

#### A. Test User Tier Restrictions API
```bash
# Login as PD user and get token
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "pd_user", "password": "password123"}'

# Use the returned access token
export TOKEN="your_access_token_here"

# Get user's allowed selling tiers
curl -X GET "http://127.0.0.1:8000/api/pricing-utils/?action=user_allowed_tiers" \
  -H "Authorization: Bearer $TOKEN"

# Expected Response for PD user:
{
  "allowed_selling_tiers": [
    {"value": "DD", "label": "District Distributor"},
    {"value": "CD", "label": "City Distributor"},
    {"value": "RS", "label": "Reseller"},
    {"value": "SUB-RS", "label": "Sub-Reseller"},
    {"value": "SRP", "label": "Suggested Retail Price"}
  ],
  "user_cost_tier": "PD",
  "user_cost_tier_display": "Provincial Distributor"
}
```

#### B. Test All Available Tiers API
```bash
curl -X GET "http://127.0.0.1:8000/api/pricing-utils/" \
  -H "Authorization: Bearer $TOKEN"

# Expected Response:
{
  "pricing_tiers": [
    {"value": "SRP", "label": "Suggested Retail Price"},
    {"value": "RD", "label": "Regional Distributor"},
    {"value": "PD", "label": "Provincial Distributor"},
    // ... all tiers
  ]
}
```

### Test 2: Frontend UI Testing

#### A. User Tier Management Page
1. Login as admin user
2. Navigate to `/admin/user-tier-management`
3. You should see:
   - List of all users with their current cost tiers
   - Dropdown to change user tiers
   - Visual tier hierarchy
   - Example scenarios

#### B. Transaction Creation Testing
1. **Login as PD User**
   ```
   Username: pd_user
   Password: password123
   ```

2. **Create Sell Transaction**
   - Go to Transactions → Add Transaction
   - Select "Sell Products (to Customers)"
   - Enter customer name: "Test Customer"
   - Select a brand and item

3. **Check Pricing Tier Restrictions**
   - In the pricing tier dropdown, you should ONLY see:
     - District Distributor (DD)
     - City Distributor (CD)
     - Reseller (RS)
     - Sub-Reseller (SUB-RS)
     - Suggested Retail Price (SRP)
   - You should NOT see:
     - Regional Distributor (RD)
     - Provincial Distributor (PD)

4. **Test Error Messages**
   - Try to submit without selecting pricing tier
   - Expected error: "Pricing tier is required for all items when selling products"

#### C. Compare Different Users
1. **Login as RS User**
   ```
   Username: rs_user
   Password: password123
   ```
   - Available tiers: SUB-RS, SRP only
   - Restricted tiers: RD, PD, DD, CD, RS

2. **Login as Admin User**
   ```
   Username: admin_user
   Password: password123
   ```
   - Available tiers: All tiers (no restrictions)

### Test 3: Tier Restriction Demo

#### A. Interactive Demo Component
1. Navigate to the TierRestrictionDemo component
2. **Simulate Different User Tiers**:
   - Click different tier buttons at the top
   - Watch how allowed/restricted tiers change in real-time

3. **Try Tier Selection**:
   - Select pricing tiers from dropdown
   - See immediate feedback (✅ allowed vs ❌ restricted)

#### B. Visual Verification
- Green ✅ = User can sell at this tier
- Red ❌ = User cannot sell at this tier
- Yellow "YOU" badge = User's current cost tier

## 📋 Expected Test Results

### Tier Hierarchy (Highest to Lowest Price)
```
RD → PD → DD → CD → RS → SUB-RS → SRP
```

### User Restrictions Matrix
| User Cost Tier | Can Sell At | Cannot Sell At |
|----------------|-------------|----------------|
| RD | PD, DD, CD, RS, SUB-RS, SRP | RD |
| PD | DD, CD, RS, SUB-RS, SRP | RD, PD |
| DD | CD, RS, SUB-RS, SRP | RD, PD, DD |
| CD | RS, SUB-RS, SRP | RD, PD, DD, CD |
| RS | SUB-RS, SRP | RD, PD, DD, CD, RS |
| SUB-RS | SRP | RD, PD, DD, CD, RS, SUB-RS |
| SRP | None | All tiers |
| null (Admin) | All tiers | None |

## 🐛 Troubleshooting

### Issue 1: "User has no allowed selling tiers"
**Cause**: User's cost_tier is not set or invalid
**Solution**:
1. Check user's cost_tier in admin panel
2. Ensure it's one of: RD, PD, DD, CD, RS, SUB-RS, SRP

### Issue 2: "Pricing tier dropdown is empty"
**Cause**: User tier restrictions not loaded
**Solution**:
1. Check browser console for API errors
2. Verify user is authenticated
3. Check backend `/pricing-utils/` endpoint

### Issue 3: "All tiers are restricted"
**Cause**: User has cost_tier = "SRP" (lowest tier)
**Solution**: Users with SRP tier cannot sell (they're end customers)

### Issue 4: Transaction fails with batch errors
**Cause**: No inventory batches available for testing
**Solution**:
1. Create some inventory via "Receive Products" transactions first
2. Or use the validation bypass for testing (items without batches)

## 🔍 Verification Checklist

### Backend Verification
- [ ] Migration applied successfully
- [ ] Users have cost_tier values set
- [ ] API returns correct allowed tiers for each user
- [ ] Transaction creation validates pricing tiers
- [ ] Database stores pricing_tier in TransactionItem

### Frontend Verification
- [ ] Tier restrictions load on component mount
- [ ] Pricing tier dropdown shows only allowed options
- [ ] Error messages display for restricted tiers
- [ ] Transaction submission includes pricing tier data
- [ ] User tier management interface works

### Business Logic Verification
- [ ] Users cannot sell at their own tier or higher
- [ ] Pricing calculations work correctly
- [ ] Error handling prevents unauthorized transactions
- [ ] Admin users have no restrictions

## 📝 Test Data Setup

### Sample Items with Tier Pricing
```sql
-- Insert sample item tier pricing
INSERT INTO item_tier_pricing (item_id, pricing_tier, price) VALUES
(1, 'RD', 100.00),
(1, 'PD', 90.00),
(1, 'DD', 80.00),
(1, 'CD', 70.00),
(1, 'RS', 60.00),
(1, 'SUB-RS', 50.00),
(1, 'SRP', 40.00);
```

### Sample Customers
```python
# Create test customers
Customer.objects.create(
    company_name="Test Customer 1",
    contact_person="John Doe",
    address="123 Test St",
    contact_number="123-456-7890",
    customer_type="Direct Customer"
)
```

## 🎯 Success Criteria

✅ **Tier restrictions work correctly**
- PD user can only select DD, CD, RS, SUB-RS, SRP
- RS user can only select SUB-RS, SRP
- Admin user can select any tier

✅ **Error handling is user-friendly**
- Clear messages when unauthorized tiers selected
- Validation prevents submission of invalid transactions

✅ **UI reflects restrictions**
- Dropdowns only show allowed options
- Visual indicators show user's limitations

✅ **Business logic enforced**
- Users cannot sell at unprofitable price points
- Proper hierarchy maintained across system

## 🔄 Continuous Testing

### Automated Tests (Recommended)
```python
# Example unit test
def test_user_allowed_selling_tiers():
    user = Account.objects.create(username="test", cost_tier="PD")
    allowed_tiers = user.get_allowed_selling_tiers()
    expected = ['DD', 'CD', 'RS', 'SUB-RS', 'SRP']
    assert allowed_tiers == expected
```

### Manual Test Cases
1. **Tier Assignment**: Test all tier assignments work correctly
2. **API Responses**: Verify correct data returned for each user type
3. **UI Restrictions**: Check dropdowns reflect proper limitations
4. **Transaction Flow**: End-to-end transaction creation with pricing
5. **Error Scenarios**: Test all error conditions and messages

---

**Happy Testing! 🚀**

This system ensures users can only sell at profitable price points while maintaining proper pricing hierarchy across your beauty product distribution network.
