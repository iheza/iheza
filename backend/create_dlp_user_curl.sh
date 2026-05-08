#!/bin/bash
# Command to create DLP user on production server
# Replace YOUR_ADMIN_TOKEN with actual admin token
curl -X POST 'https://iheza.online/api/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -d '{"access_code": "DLP/PRINCIPAL/0001/2024", "first_name": "DLP", "last_name": "Principal", "email": "principal@dlp.edu", "phone": "", "role": "principal", "status": "active", "password": "DLP00000"}'