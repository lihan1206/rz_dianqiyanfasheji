#!/bin/bash

ENV=${1:-dev}
DB_URL=${DB_URL}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

echo "Running migration for environment: $ENV"

liquibase \
    --url="$DB_URL" \
    --username="$DB_USER" \
    --password="$DB_PASS" \
    --contexts="$ENV" \
    --changeLogFile=db/changelog/db.changelog-master.xml \
    update

if [ $? -eq 0 ]; then
    echo "Migration completed successfully"
else
    echo "Migration failed"
    exit 1
fi
