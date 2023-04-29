#!/bin/bash

auth_token="find token in network requests from https://sam-test.stoplight.io/docs/sam"

base_url="https://stoplight.io/api/v1/projects/sam-test/sam/nodes/models/"
device_data_models=("BillingAddress" "ListItem" "Order" "Quote" "ServicePreference" "User" "UserAddress" "UserId" "UserPaymentCard" "UserPhone")
public_data_models=("API" "Device" "Endpoint" "Member" "Organization" "Service" "ServiceProvider" "Transaction" "TransactionUpdate")
ui_builder_models=("UIElement" "UIProposal" "UIServiceElement" "UIVariable")

for model in "${device_data_models[@]}"
do
  url="${base_url}Device%20Data/${model}.json?token=${auth_token}"
  echo "Requesting ${model}"
  curl --silent --show-error ${url} > models/${model}.json
done

for model in "${public_data_models[@]}"
do
  url="${base_url}Public%20Data/${model}.json?token=${auth_token}"
  echo "Requesting ${model}"
  curl --silent --show-error ${url} > models/${model}.json
done

for model in "${ui_builder_models[@]}"
do
  url="${base_url}UI%20Builder/${model}.json?token=${auth_token}"
  echo "Requesting ${model}"
  curl --silent --show-error ${url} > models/${model}.json
done

all_models=( "${device_data_models[@]}" "${public_data_models[@]}" "${ui_builder_models[@]}" )
for model in "${all_models[@]}"
do
  echo "Processing ${model}"
  quicktype -s schema models/${model}.json -o ../src/models/${model}.rs
done
