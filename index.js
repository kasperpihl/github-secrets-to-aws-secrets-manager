const core = require("@actions/core");
const { readFileSync, rmSync } = require("node:fs");
const { execSync } = require("node:child_process");
const { join } = require("node:path");

// All github actions input is prefixed with INPUT_
const inputPrefix = "INPUT_";
const PREFIX = (process.env.INPUT_PREFIX || "appsecrets").replace(/^\/+/, "");

console.log(`Secrets Manager sync - PREFIX: ${PREFIX}`);

try {
  const resFile = join(__dirname, "existing.json");
  // Get all existing secrets that match our prefix
  execSync(`aws secretsmanager list-secrets > ${resFile}`);

  // Load secrets that match our prefix
  let remainingNames = JSON.parse(readFileSync(resFile)).SecretList
    .filter(({ Name }) => Name.startsWith(`${PREFIX}/`))
    .map(({ Name }) => Name);

  console.log(`Found ${remainingNames.length} existing secrets with prefix: ${PREFIX}/`);

  // Remove json file
  rmSync(resFile);

  // Extract secrets from environment variables
  const variables = Object.keys(process.env)
    .map(function (key) {
      if (key.startsWith(inputPrefix) && key !== "INPUT_PREFIX") {
        const secretName = key.substring(inputPrefix.length);
        const fullPath = `${PREFIX}/${secretName}`;
        const value = process.env[key];
        return [fullPath, value];
      }
      return null;
    })
    .filter((v) => !!v);

  console.log(`Processing ${variables.length} secrets`);

  // Save all secrets
  variables.forEach(([secretId, value]) => {
    if (!value) {
      console.log(`Skipping empty secret: ${secretId}`);
      return;
    }

    console.log(`Processing secret: ${secretId}`);

    try {
      // Try to describe the secret first to see if it exists
      execSync(`aws secretsmanager describe-secret --secret-id "${secretId}"`, {
        stdio: "pipe",
      });

      // Secret exists - update it
      console.log(`Updating existing secret: ${secretId}`);
      execSync(
        `aws secretsmanager update-secret --secret-id "${secretId}" --secret-string "${value}"`,
        { stdio: "pipe" }
      );
    } catch (describeError) {
      // Secret doesn't exist - create it
      console.log(`Creating new secret: ${secretId}`);
      try {
        execSync(
          `aws secretsmanager create-secret --name "${secretId}" --description "Synced from GitHub Secrets" --secret-string "${value}"`,
          { stdio: "pipe" }
        );
      } catch (createError) {
        console.error(`Failed to create secret ${secretId}: ${createError.message}`);
        throw createError;
      }
    }

    // Remove this secret from the list of secrets to delete
    remainingNames = remainingNames.filter((name) => name !== secretId);
  });

  // Delete secrets that are no longer in GitHub Secrets
  // Only delete secrets with our prefix to avoid deleting unrelated secrets
  if (remainingNames.length) {
    console.log(`Deleting ${remainingNames.length} unused secrets with prefix ${PREFIX}/`);
    remainingNames.forEach((name) => {
      console.log(`Deleting secret: ${name}`);
      try {
        execSync(
          `aws secretsmanager delete-secret --secret-id "${name}" --force-delete-without-recovery`,
          { stdio: "pipe" }
        );
      } catch (deleteError) {
        console.error(`Failed to delete secret ${name}: ${deleteError.message}`);
        // Don't throw - continue deleting other secrets
      }
    });
  }

  console.log("✅ All secrets synced successfully");
} catch (error) {
  console.error(`❌ Fatal error: ${error.message}`);
  core.setFailed(error.message);
}
