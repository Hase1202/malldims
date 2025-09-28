# Dynamic Transaction Pricing Implementation

## Overview
This document describes the implementation of dynamic transaction pricing based on user cost tiers. The system restricts user selling price options based on their own purchase price tier, ensuring profitability and proper pricing hierarchy.

## Core Business Rule
**If a user's Cost Price tier is at a certain level (e.g., Provincial Distributor), they can only sell at tiers below it (e.g., DD, CD, RS, SUB-RS, SRP). They cannot sell at their own tier or higher.**

## Pricing Tier Hierarchy
```
RD (Regional Distributor) → PD (Provincial Distributor) → DD (District Distributor) → CD (City Distributor) → RS (Reseller) → SUB-RS (Sub-Reseller) → SRP (Suggested Retail Price)

Highest Price ←→ Lowest Price
```

## Implementation Components

### 1. Backend Changes

#### Models (agmall-dims/backend/inventory/models.py)
- **Added `cost_tier` field to Account model**
  - Tracks the pricing tier at which each user purchases products
  - Determines their selling restrictions
  - Nullable for admin users (no restrictions)

- **Added tier restriction methods to Account model**
  ```python
  def get_allowed_selling_tiers(self):
      """Returns the pricing tiers this user is allowed to sell at."""

  def can_sell_at_tier(self, tier):
      """Check if this user can sell at a specific pricing tier."""
  ```

#### Services (agmall-dims/backend/inventory/services.py)
- **Enhanced PricingService with user restrictions**
  - `get_user_allowed_selling_tiers(user)` - Get tiers user can sell at
  - `validate_user_can_sell_at_tier(user, tier)` - Validate tier permissions
  - `get_price_for_user_transaction()` - Price calculation with user restrictions

#### Views (agmall-dims/backend/inventory/views.py)
- **Enhanced PricingUtilsView**
  - `GET /pricing-utils/?action=user_allowed_tiers` - Returns user's allowed selling tiers
  - `POST /pricing-utils/` - Calculate prices with user tier validation

#### Migration (agmall-dims/backend/inventory/migrations/0022_add_account_cost_tier.py)
- Adds `cost_tier` field to Account table
- Includes proper choices and constraints

### 2. Frontend Changes

#### Types (agmall-dims/frontend/src/types/inventory.ts)
- **Added tier restriction types**
  ```typescript
  interface UserTierRestrictions {
    user_cost_tier: PricingTier | null;
    allowed_selling_tiers: PricingTierOption[];
  }

  interface PricingCalculationResult {
    tier_restriction_violated?: boolean;
    user_cost_tier?: PricingTier | null;
    allowed_selling_tiers?: string[];
  }
  ```

#### API Client (agmall-dims/frontend/src/lib/api.ts)
- **Enhanced pricingApi with restriction functions**
  - `getUserAllowedTiers()` - Get user's allowed selling tiers
  - `calculatePriceForUser()` - Calculate prices with tier validation
  - `getAllTiers()` - Get all available pricing tiers

#### Transaction Component (agmall-dims/frontend/src/pages/transactions/AddTransaction.tsx)
- **Added tier restriction logic**
  - Loads user's allowed selling tiers on component mount
  - Restricts tier dropdown options based on user permissions
  - Shows error messages when unauthorized tiers are selected
  - Validates pricing tiers before transaction submission

#### User Management (agmall-dims/frontend/src/pages/admin/UserTierManagement.tsx)
- **New admin interface for managing user cost tiers**
  - View all users and their current cost tiers
  - Update user cost tiers with dropdown selection
  - Visual representation of tier hierarchy
  - Example scenarios showing how restrictions work

### 3. Business Logic Flow

#### User Registration/Setup
1. Admin assigns cost tier to user based on their purchase agreements
2. User's cost tier determines their selling restrictions
3. System calculates allowed selling tiers automatically

#### Transaction Creation
1. User selects "Sell Products" transaction type
2. System loads user's allowed selling tiers from backend
3. Pricing tier dropdown only shows allowed options
4. User selects customer and items
5. System validates selected tier against user permissions
6. Transaction is created with validated pricing tier

#### Pricing Calculation
1. User selects pricing tier for transaction item
2. System checks if user can sell at selected tier
3. If valid, calculates price based on item tier pricing
4. If invalid, shows error and prevents transaction

## Example Scenarios

### Scenario 1: Provincial Distributor User
- **User Cost Tier:** PD (Provincial Distributor)
- **Allowed Selling Tiers:** DD, CD, RS, SUB-RS, SRP
- **Restricted Tiers:** RD, PD
- **Result:** User can sell at any tier below PD, ensuring profitability

### Scenario 2: Reseller User
- **User Cost Tier:** RS (Reseller)
- **Allowed Selling Tiers:** SUB-RS, SRP
- **Restricted Tiers:** RD, PD, DD, CD, RS
- **Result:** Limited selling options but guaranteed profit margins

### Scenario 3: Admin User
- **User Cost Tier:** None (null)
- **Allowed Selling Tiers:** All tiers
- **Restricted Tiers:** None
- **Result:** Full flexibility for administrative purposes

## Error Handling

### Frontend Validation
- Shows user-friendly error messages when invalid tiers are selected
- Disables unauthorized tier options in dropdowns
- Provides clear feedback about user's tier restrictions

### Backend Validation
- Validates tier permissions on transaction creation
- Returns specific error messages for tier violations
- Prevents unauthorized transactions from being processed

## Security Considerations

### Authorization
- Users cannot modify their own cost tier
- Only admins can assign/modify user cost tiers
- API endpoints validate user permissions server-side

### Data Integrity
- Database constraints ensure valid tier assignments
- Server-side validation prevents tier restriction bypassing
- Audit trail for tier changes (future enhancement)

## Testing Scenarios

### Unit Tests (Recommended)
1. Test `get_allowed_selling_tiers()` method with different cost tiers
2. Test `can_sell_at_tier()` method with valid/invalid tier combinations
3. Test pricing calculation with tier restrictions
4. Test API endpoint responses for different user types

### Integration Tests (Recommended)
1. Test complete transaction flow with tier restrictions
2. Test admin tier assignment functionality
3. Test error handling for unauthorized tier selections
4. Test edge cases (null cost tier, invalid tiers)

## Future Enhancements

### Planned Features
1. **Audit Trail** - Track changes to user cost tiers
2. **Bulk Tier Updates** - Update multiple users at once
3. **Tier-based Dashboards** - Show analytics by user tier
4. **Custom Tier Rules** - Allow exceptions for specific products
5. **Dynamic Tier Calculation** - Auto-adjust based on purchase volume

### Performance Optimizations
1. Cache user tier restrictions in frontend
2. Optimize tier hierarchy queries
3. Add database indexes for tier-related queries
4. Implement tier restriction middleware

## Deployment Steps

### Backend Deployment
1. Run migration: `python manage.py migrate inventory`
2. Update existing users with appropriate cost tiers
3. Test API endpoints with different user roles
4. Verify tier restriction logic

### Frontend Deployment
1. Build and deploy updated frontend code
2. Clear browser caches to load new components
3. Test transaction flows with different user types
4. Verify error messages and user feedback

### Production Checklist
- [ ] Database migration applied
- [ ] User cost tiers assigned
- [ ] API endpoints tested
- [ ] Frontend components working
- [ ] Error handling functional
- [ ] Admin interface accessible
- [ ] Documentation updated

## Conclusion

The dynamic transaction pricing system successfully implements tier-based selling restrictions to ensure profitability and maintain proper pricing hierarchy. Users can only sell at tiers below their purchase tier, preventing unprofitable transactions while maintaining system flexibility for administrators.

The implementation provides a robust foundation for advanced pricing management and can be extended with additional features as business requirements evolve.
