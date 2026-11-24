const express = require('express');
const path = require('node:path');

const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
    // res.json({
    //     servico: 'webhook de pagamentos',
    //     status: 'online'
    // })
});

app.use("/pagamentos", paymentRoutes);
app.use("/webhook", webhookRoutes);

module.exports = app;