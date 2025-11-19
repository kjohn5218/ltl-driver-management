# Database Migration Instructions

## Adding Booking Documents Feature

To apply the booking documents migration, run the following SQL file against your PostgreSQL database:

```bash
psql -U your_username -d ltl_management -f add_booking_documents.sql
```

Or connect to your database and run the SQL commands in `add_booking_documents.sql`.

This migration adds:
1. Document tracking fields to the bookings table
2. A new booking_documents table to store uploaded document metadata
3. Necessary indexes and constraints

After running the migration, restart your server to ensure Prisma client is regenerated with the new schema.