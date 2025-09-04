#!/usr/bin/env python3
"""
Script to import route data from Excel spreadsheet to PostgreSQL database
"""
import pandas as pd
import psycopg2
import sys
from datetime import datetime
import re

def clean_time_string(time_str):
    """Clean and normalize time strings from Excel"""
    if pd.isna(time_str):
        return None
    
    time_str = str(time_str)
    
    # Handle datetime objects with incorrect dates (1900-01-01 indicates next day)
    if '1900-01-01' in time_str:
        # Extract just the time part
        match = re.search(r'(\d{2}:\d{2}:\d{2})', time_str)
        if match:
            return match.group(1)
    
    # Handle time-only strings
    if ':' in time_str:
        # If it's already in HH:MM:SS format
        if len(time_str.split(':')) == 3:
            return time_str
        # If it's in HH:MM format, add seconds
        elif len(time_str.split(':')) == 2:
            return time_str + ':00'
    
    # Handle other time formats
    try:
        # Try to parse as time
        dt = pd.to_datetime(time_str)
        return dt.strftime('%H:%M:%S')
    except:
        return time_str

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
        df = pd.read_excel('/Users/kevinjohn/Documents/Linehaulroutes.xlsx')
        print(f"Loaded {len(df)} routes from spreadsheet")
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        sys.exit(1)
    
    # Clear existing routes
    try:
        cursor.execute("DELETE FROM routes")
        conn.commit()
        print("Cleared existing routes")
    except Exception as e:
        print(f"Error clearing existing routes: {e}")
    
    # Insert new routes
    insert_query = """
        INSERT INTO routes (name, origin, destination, distance, miles, active, "departureTime", "arrivalTime", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    successful_inserts = 0
    failed_inserts = 0
    
    for index, row in df.iterrows():
        try:
            # Clean the data
            name = row['Name']
            origin = row['Orig']
            destination = row['Dest']
            miles = float(row['Miles']) if pd.notna(row['Miles']) else None
            active = bool(row['Active'])
            
            # Clean time strings
            departure_time = clean_time_string(row['Depart Time'])
            arrival_time = clean_time_string(row['Arrive Time'])
            
            # Use miles as distance (same value), skip if null
            if miles is None:
                continue
            distance = miles
            
            now = datetime.now()
            
            cursor.execute(insert_query, (
                name, origin, destination, distance, miles, active,
                departure_time, arrival_time, now, now
            ))
            
            successful_inserts += 1
            
        except Exception as e:
            print(f"Error inserting route {row.get('Name', 'Unknown')}: {e}")
            failed_inserts += 1
            continue
    
    try:
        conn.commit()
        print(f"Successfully imported {successful_inserts} routes")
        if failed_inserts > 0:
            print(f"Failed to import {failed_inserts} routes")
    except Exception as e:
        print(f"Error committing transaction: {e}")
        conn.rollback()
    
    cursor.close()
    conn.close()
    print("Database connection closed")

if __name__ == "__main__":
    main()