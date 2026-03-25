-- 012: Clean up N/A placeholder values in clients and prospects
-- NOT NULL columns → empty string, nullable columns → NULL

-- Clients (first_name, last_name, address_line1, postal_code, city are NOT NULL)
UPDATE clients SET first_name = '' WHERE first_name = 'N/A';
UPDATE clients SET last_name = '' WHERE last_name = 'N/A';
UPDATE clients SET address_line1 = '' WHERE address_line1 = 'N/A';
UPDATE clients SET postal_code = '' WHERE postal_code = 'N/A';
UPDATE clients SET city = '' WHERE city = 'N/A';
UPDATE clients SET company_name = NULL WHERE company_name = 'N/A';
UPDATE clients SET email = NULL WHERE email = 'N/A';
UPDATE clients SET phone = NULL WHERE phone = 'N/A';
UPDATE clients SET mobile = NULL WHERE mobile = 'N/A';
UPDATE clients SET address_line2 = NULL WHERE address_line2 = 'N/A';
UPDATE clients SET siret = NULL WHERE siret = 'N/A';
UPDATE clients SET tva_number = NULL WHERE tva_number = 'N/A';
UPDATE clients SET notes = NULL WHERE notes = 'N/A';

-- Prospects (first_name, last_name are NOT NULL)
UPDATE prospects SET first_name = '' WHERE first_name = 'N/A';
UPDATE prospects SET last_name = '' WHERE last_name = 'N/A';
UPDATE prospects SET company_name = NULL WHERE company_name = 'N/A';
UPDATE prospects SET email = NULL WHERE email = 'N/A';
UPDATE prospects SET phone = NULL WHERE phone = 'N/A';
UPDATE prospects SET mobile = NULL WHERE mobile = 'N/A';
UPDATE prospects SET address_line1 = NULL WHERE address_line1 = 'N/A';
UPDATE prospects SET postal_code = NULL WHERE postal_code = 'N/A';
UPDATE prospects SET city = NULL WHERE city = 'N/A';
UPDATE prospects SET notes = NULL WHERE notes = 'N/A';
