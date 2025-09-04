#!/usr/bin/env python3
"""
Script to import carrier data from Excel spreadsheet to PostgreSQL database
"""
import pandas as pd
import psycopg2
import sys
from datetime import datetime
import re

def clean_phone(phone_str):
    """Clean and format phone numbers"""
    if pd.isna(phone_str):
        return None
    
    # Convert to string and remove non-digits
    phone_clean = re.sub(r'\D', '', str(phone_str))
    
    # Format as (XXX) XXX-XXXX if it's a 10-digit US number
    if len(phone_clean) == 10:
        return f"({phone_clean[:3]}) {phone_clean[3:6]}-{phone_clean[6:]}"
    elif len(phone_clean) == 11 and phone_clean.startswith('1'):
        # Remove leading 1 for US numbers
        phone_clean = phone_clean[1:]
        return f"({phone_clean[:3]}) {phone_clean[3:6]}-{phone_clean[6:]}"
    else:
        return phone_clean if phone_clean else None

def clean_string(s):
    """Clean string by stripping whitespace"""
    if pd.isna(s):
        return None
    return str(s).strip() if str(s).strip() else None

def map_status(excel_status):
    """Map Excel status to our enum values"""
    if pd.isna(excel_status):
        return 'PENDING'
    
    status_clean = str(excel_status).strip().upper()
    if 'NOT ONBOARDED' in status_clean:
        return 'NOT_ONBOARDED'
    elif 'ONBOARDED' in status_clean:
        return 'ONBOARDED'
    else:
        return 'PENDING'

def main():
    # Database connection
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="ltl_management",
            user="admin",
            password="admin123"
        )
        cursor = conn.cursor()
        print("Connected to database successfully")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)
    
    # Read Excel file
    try:
        df = pd.read_excel('/Users/kevinjohn/Documents/3bd2f474846e934f8cb18a.xls')
        print(f"Loaded {len(df)} carriers from spreadsheet")
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        sys.exit(1)
    
    # Clear existing carriers (keep the sample ones for now, just comment this out)
    # try:
    #     cursor.execute("DELETE FROM carriers WHERE id > 3")  # Keep the 3 sample carriers
    #     conn.commit()
    #     print("Cleared existing imported carriers")
    # except Exception as e:
    #     print(f"Error clearing existing carriers: {e}")
    
    # Insert new carriers - handle duplicates by skipping them
    insert_query = """
        INSERT INTO carriers (
            name, "contactPerson", phone, email, "mcNumber", "dotNumber", 
            status, "safetyRating", "taxId", "carrierType", "streetAddress1", 
            "streetAddress2", city, state, "zipCode", "remittanceContact", 
            "remittanceEmail", "factoringCompany", "onboardingComplete", 
            "createdAt", "updatedAt"
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("mcNumber") DO NOTHING
    """
    
    successful_inserts = 0
    failed_inserts = 0
    
    for index, row in df.iterrows():
        try:
            # Clean and prepare the data
            name = clean_string(row['Carrier Name'])
            if not name:
                continue  # Skip rows without carrier names
            
            contact_person = clean_string(row['Primary Contact'])
            phone = clean_phone(row['Phone'])
            email = clean_string(row['Primary Email'])
            mc_number = clean_string(str(int(row['MC Number']))) if pd.notna(row['MC Number']) else None
            dot_number = clean_string(str(int(row['DOT Number']))) if pd.notna(row['DOT Number']) else None
            
            # Skip if both MC and DOT are missing
            if not mc_number and not dot_number:
                continue
            status = map_status(row['Status'])
            safety_rating = clean_string(row['Safety Rating'])
            tax_id = clean_string(row['TAX ID'])
            carrier_type = clean_string(row['Type'])
            street_address1 = clean_string(row['Street Address 1'])
            street_address2 = clean_string(row['Street Address 2'])
            city = clean_string(row['City'])
            state = clean_string(row['ST'])
            zip_code = clean_string(row['Zip'])
            remittance_contact = clean_string(row['Remittance Contact'])
            remittance_email = clean_string(row['Remittance Email'])
            factoring_company = clean_string(row['Factoring Company'])
            
            onboarding_complete = status == 'ONBOARDED'
            now = datetime.now()
            
            cursor.execute(insert_query, (
                name, contact_person, phone, email, mc_number, dot_number,
                status, safety_rating, tax_id, carrier_type, street_address1,
                street_address2, city, state, zip_code, remittance_contact,
                remittance_email, factoring_company, onboarding_complete,
                now, now
            ))
            
            successful_inserts += 1
            
            if successful_inserts % 500 == 0:
                print(f"Processed {successful_inserts} carriers...")
                
        except Exception as e:
            print(f"Error inserting carrier {name}: {e}")
            failed_inserts += 1
            continue
    
    try:
        conn.commit()
        print(f"Successfully imported {successful_inserts} carriers")
        if failed_inserts > 0:
            print(f"Failed to import {failed_inserts} carriers")
    except Exception as e:
        print(f"Error committing transaction: {e}")
        conn.rollback()
    
    cursor.close()
    conn.close()
    print("Database connection closed")

if __name__ == "__main__":
    main()