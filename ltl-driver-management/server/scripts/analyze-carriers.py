import pandas as pd

# Read the Excel file
df = pd.read_excel('/Users/kevinjohn/Documents/3bd2f474846e934f8cb18a.xls')

print(f"Total carriers: {len(df)}")
print(f"Columns: {len(df.columns)}")
print()

# Key columns for mapping
key_columns = ['Carrier Name', 'Status', 'MC Number', 'DOT Number', 'Primary Contact', 'Primary Email', 'Phone', 'Safety Rating', 'City', 'ST']

for col in key_columns:
    if col in df.columns:
        non_null_count = df[col].notna().sum()
        print(f"{col}: {non_null_count} non-null values")
        if non_null_count > 0:
            sample_values = df[col].dropna().head(3).tolist()
            print(f"  Sample: {sample_values}")
    print()

print("Unique Status values:", df['Status'].value_counts().to_dict())
print("Unique Safety Rating values:", df['Safety Rating'].value_counts().to_dict())