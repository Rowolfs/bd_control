const express = require('express');
const app = express();
const port = 3000;



.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Connection error:', err));

app.use(express.json())


app.listen(port,() => {

console.log(`Server is running on http://localhost:${port}`)

})


