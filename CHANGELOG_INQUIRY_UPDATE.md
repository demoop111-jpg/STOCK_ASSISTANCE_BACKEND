# Backend Inquiry Update

Added:

1. New `Inquiry` model / collection: `inquiries`
2. New API: `POST /api/chat/check-availability`
3. Inquiry logging for:
   - Item not found attempts
   - PCS quantity inquiry
   - BOX quantity inquiry
   - Availability result
   - Timestamp, session ID, user agent, IP
4. Dashboard update:
   - Total inquiries
   - Today's inquiries
   - Top inquiry items
5. Admin API:
   - `GET /api/admin/inquiries`

Box conversion rules:
- LS... = 30 PCS per BOX
- H... = 20 PCS per BOX
- L... = 16 PCS per BOX

Database stock remains in PCS/NOS. Frontend replies in the unit selected by the user.
