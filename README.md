# shubukanindia-backend

---

## Error: 

Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted. Make sure your current IP address is on your Atlas cluster's IP whitelist: https://www.mongodb.com/docs/atlas/security-whitelist/


---

db.registrations.dropIndex("email_1")

---

The best example of "How to perform arithmetic operations on Data datatype" :

```
// get a new date
const newDate = new Date();

// date stored in database in string format
const stringDate = "2026-01-11T07:12:54.242Z";

// convert to Date datatype
const realDate = new Date(stringDate);

// getTime() only apply to Date datatype
const time = realDate.getTime();

const minutes = 15;

// perform arithmetic operations on time
const finalTime = time + minutes * 60 * 1000;

// convert to Date datatype
const finalDate = new Date(finalTime);

console.log(finalDate);
```