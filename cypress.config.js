const { defineConfig } = require("cypress");
require("dotenv").config({ quiet: true });

module.exports = defineConfig({
    e2e: {
        baseUrl: `http://127.0.0.1:${process.env.PORT || 5000}`,
        supportFile: false
    },
    env: {
        webhookToken: process.env.WEBHOOK_TOKEN
    }
});
