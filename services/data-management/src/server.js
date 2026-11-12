const express = require('express');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'data-management'
    });
});

app.listen(PORT, () => {
    console.log(`Data Management Service running on port ${PORT}`);
});