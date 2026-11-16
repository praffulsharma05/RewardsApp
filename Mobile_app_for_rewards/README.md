# Mobile App for Rewards - Customer Rewards Collection & Admin Management

Mobile wireframe prototype for customer rewards point collection, capping policies, redemptions, and admin management with IndexedDB persistence.

## Key Components

### 1. Admin Panel (`admin.html`)
- **Grant Tab**: Issue reward points on order amounts with automatic policy calculation and photo upload.
- **Apply Rewards Tab (`admin_apply.js`)**:
  - Select customer from registered customer list with live available reward points (e.g. 60,000 PTS).
  - **Automatic Capping Calculation**: Manual "Capping Rules & Points to Apply" section removed. Capping percentage and max limits are automatically applied based on the admin policy set for that user (e.g. 40% or 50% capping up to ₹10,000 max).
  - Dynamic due amount calculation (e.g. on a ₹20,000 product with 40% cap: auto-applies 8,000 PTS = ₹12,000 due amount paid to shopkeeper).
  - 20% reward points gain on the paid due amount (e.g. 20% on ₹12,000 = +2,400 PTS gained by customer).
  - Updates customer's wallet balance in real-time.
- **Issued Tab**: View granted rewards and applied redemptions.
- **Settings & Overview**: Configure default reward rate, expiry duration, capping % and view system analytics.

### 2. Customer Wallet (`wallet.html`)
- **Total Available Reward Points**: Live balance reflecting granted points, redeemed points, and new points gained from purchases.
- **Redemption Policy & Nearest Expiry Alert**: Displays active capping rule and highlights nearest expiring reward points with countdown.
- **Segmented Lists**:
  - **Gained Rewards**: Collapsible view showing product, points (+PTS), and expiry date in the collapsed header, expandable for complete order breakdowns.
  - **Applied on Products**: Separate list displaying redeemed points (-PTS), original price, due amount paid to shopkeeper, and 20% points gained (+PTS).

### 3. Strict Architecture Compliance
- Every `.html` and `.js` file is strictly under 300 lines of code.
- Unified IndexedDB storage (`RewardsDB v3`) with offline `localStorage` fallback.
