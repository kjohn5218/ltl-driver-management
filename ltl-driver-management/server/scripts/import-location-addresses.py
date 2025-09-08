#!/usr/bin/env python3
"""
Script to import location addresses from Excel file and update route locations.
This script reads the Location addresses.xlsx file and updates the routes table
with complete address information for origins and destinations.
"""

import pandas as pd
import json
import sys
import os

def read_location_data(excel_file_path):
    """Read location data from Excel file"""
    try:
        # Try reading the Excel file
        df = pd.read_excel(excel_file_path)
        print(f"Successfully read Excel file with {len(df)} rows")
        print(f"Columns: {list(df.columns)}")
        return df
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return None

def clean_location_name(name):
    """Clean and standardize location names for matching"""
    if pd.isna(name):
        return ""
    return str(name).strip().upper()

def process_locations(df):
    """Process the location data and create a mapping dictionary"""
    location_mapping = {}
    
    # Print first few rows to understand the structure
    print("\nFirst 5 rows of data:")
    print(df.head())
    
    # Assuming the Excel has columns like: Location, Address, City, State, ZipCode
    # Adjust column names based on actual Excel structure
    for index, row in df.iterrows():
        # You may need to adjust these column names based on the actual Excel structure
        location_cols = [col for col in df.columns if 'location' in col.lower() or 'city' in col.lower() or 'name' in col.lower()]
        address_cols = [col for col in df.columns if 'address' in col.lower() or 'street' in col.lower()]
        city_cols = [col for col in df.columns if 'city' in col.lower()]
        state_cols = [col for col in df.columns if 'state' in col.lower()]
        zip_cols = [col for col in df.columns if 'zip' in col.lower() or 'postal' in col.lower()]
        
        # Extract location data (this will need adjustment based on actual Excel structure)
        if location_cols:
            location = clean_location_name(row[location_cols[0]])
            address = row[address_cols[0]] if address_cols else ""
            city = row[city_cols[0]] if city_cols else ""
            state = row[state_cols[0]] if state_cols else ""
            zipcode = str(row[zip_cols[0]]) if zip_cols else ""
            
            if location:
                location_mapping[location] = {
                    'address': str(address) if pd.notna(address) else "",
                    'city': str(city) if pd.notna(city) else "",
                    'state': str(state) if pd.notna(state) else "",
                    'zipcode': str(zipcode) if pd.notna(zipcode) else ""
                }
    
    return location_mapping

def generate_sql_updates(location_mapping):
    """Generate SQL UPDATE statements for route locations"""
    sql_statements = []
    
    sql_statements.append("-- SQL statements to update route locations with address information")
    sql_statements.append("-- Generated from Location addresses.xlsx")
    sql_statements.append("")
    
    # Generate UPDATE statements for each location
    for location, address_info in location_mapping.items():
        # Update routes where this location is the origin
        sql = f"""
UPDATE routes SET 
    "originAddress" = '{address_info['address'].replace("'", "''")}',
    "originCity" = '{address_info['city'].replace("'", "''")}',
    "originState" = '{address_info['state'].replace("'", "''")}',
    "originZipCode" = '{address_info['zipcode'].replace("'", "''")}'
WHERE UPPER(origin) = '{location}';
"""
        sql_statements.append(sql)
        
        # Update routes where this location is the destination
        sql = f"""
UPDATE routes SET 
    "destinationAddress" = '{address_info['address'].replace("'", "''")}',
    "destinationCity" = '{address_info['city'].replace("'", "''")}',
    "destinationState" = '{address_info['state'].replace("'", "''")}',
    "destinationZipCode" = '{address_info['zipcode'].replace("'", "''")}'
WHERE UPPER(destination) = '{location}';
"""
        sql_statements.append(sql)
    
    return sql_statements

def generate_json_mapping(location_mapping):
    """Generate JSON file with location mapping for reference"""
    return json.dumps(location_mapping, indent=2, ensure_ascii=False)

def main():
    # Path to the Excel file
    excel_file_path = "/Users/kevinjohn/Documents/Location addresses.xlsx"
    
    # Check if file exists
    if not os.path.exists(excel_file_path):
        print(f"Excel file not found at: {excel_file_path}")
        print("Please make sure the file exists and try again.")
        return
    
    # Read the Excel file
    df = read_location_data(excel_file_path)
    if df is None:
        return
    
    # Process the locations
    location_mapping = process_locations(df)
    
    if not location_mapping:
        print("No location data could be processed. Please check the Excel file structure.")
        return
    
    print(f"\nProcessed {len(location_mapping)} locations:")
    for location, info in list(location_mapping.items())[:5]:  # Show first 5
        print(f"  {location}: {info['city']}, {info['state']} {info['zipcode']}")
    
    # Generate SQL updates
    sql_statements = generate_sql_updates(location_mapping)
    
    # Write SQL file
    sql_file = "update_route_addresses.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))
    print(f"\nSQL update file created: {sql_file}")
    
    # Generate JSON mapping for reference
    json_mapping = generate_json_mapping(location_mapping)
    json_file = "location_mapping.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        f.write(json_mapping)
    print(f"Location mapping JSON created: {json_file}")
    
    print("\nNext steps:")
    print("1. Review the generated SQL file for accuracy")
    print("2. Run the SQL updates against your database")
    print("3. Verify the route addresses have been updated correctly")

if __name__ == "__main__":
    main()