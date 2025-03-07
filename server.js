<<<<<<< Updated upstream
<<<<<<< HEAD
const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Creating the Express server
const app = express();

// Connect to SQLite database
let db = new sqlite3.Database("overall3.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});

// Session management
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// static resourse & templating engine
app.use(express.static("public"));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/style", express.static(path.join(__dirname, "style")));
// Set EJS as templating engine
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/dorm", function (req, res) {
  res.render("detail", { user: req.session.user });
});

app.get("/bill", function (req, res) {
  if (!req.session.user) {
    return res.redirect("/"); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }

  const tenantId = req.session.user.id;

  const query = `
    SELECT p.bill_id, p.payment_due_date, p.bill_status, 
           b.rent_fee, b.water_bill, b.electricity_bill, 
           b.additional_expenses, b.fine
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    WHERE p.tenant_id = ?
    ORDER BY p.payment_due_date DESC
  `;

  db.all(query, [tenantId], (err, bills) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลบิล");
    }

    console.log("Bills fetched:", bills);
    res.render("bill", { user: req.session.user, bills });
  });
});

app.get("/bill/detail/:bill_id", function (req, res) {
  if (!req.session.user) {
    return res.status(403).json({ error: "กรุณาเข้าสู่ระบบ" });
  }

  const tenantId = req.session.user.id;
  const billId = req.params.bill_id;

  console.log("Fetching bill details for bill_id:", billId);
  console.log("Tenant ID:", tenantId);

  const query = `
    SELECT p.payment_due_date, p.bill_status, p.receipt_pic, 
           'ค่าเช่าห้อง' AS item_name, b.rent_fee AS amount
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    JOIN room r ON b.room_id = r.room_id
    WHERE p.bill_id = ? AND r.tenant_ID = ? AND b.rent_fee > 0
    UNION ALL
    SELECT p.payment_due_date, p.bill_status, p.receipt_pic,
           'ค่าน้ำ', b.water_bill
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    JOIN room r ON b.room_id = r.room_id
    WHERE p.bill_id = ? AND r.tenant_ID = ? AND b.water_bill > 0
    UNION ALL
    SELECT p.payment_due_date, p.bill_status, p.receipt_pic,
           'ค่าไฟ', b.electricity_bill
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    JOIN room r ON b.room_id = r.room_id
    WHERE p.bill_id = ? AND r.tenant_ID = ? AND b.electricity_bill > 0
    UNION ALL
    SELECT p.payment_due_date, p.bill_status, p.receipt_pic,
           'ค่าบริการส่วนกลาง', b.additional_expenses
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    JOIN room r ON b.room_id = r.room_id
    WHERE p.bill_id = ? AND r.tenant_ID = ? AND b.additional_expenses > 0
    UNION ALL
    SELECT p.payment_due_date, p.bill_status, p.receipt_pic,
           'ค่าปรับ', b.fine
    FROM payment p
    JOIN bill b ON p.bill_id = b.bill_id
    JOIN room r ON b.room_id = r.room_id
    WHERE p.bill_id = ? AND r.tenant_ID = ? AND b.fine > 0
  `;

  db.all(
    query,
    [billId, tenantId, billId, tenantId, billId, tenantId, billId, tenantId, billId, tenantId],
    (err, items) => {
      if (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลบิล" });
      }

      if (!items || items.length === 0) {
        return res.status(404).json({ error: "ไม่พบรายละเอียดบิล" });
      }

      const billInfo = {
        payment_due_date: items[0].payment_due_date,
        bill_status: items[0].bill_status,
        items: items,
        receipt_pic: items[0].receipt_pic ? `/receipt/${billId}` : null, // ✅ ส่งลิงก์รูป
      };

      res.json(billInfo);
    }
  );
});

app.get("/tenant/:dormitory_id", function (req, res) {
  const dormitory_id = req.params.dormitory_id; // รับค่า dormitory_id จาก URL

  // Query รวมข้อมูลจากหลายตาราง
  const query = `
    SELECT 
      d.dormitory_id, d.dormitory_name, d.dorm_address, d.province, d.district, d.subdistrict, d.zip_code,
      di.information, di.dorm_pic,
      f.facility,
      r.room_id, r.room_type_id,
      rt.room_type_name, rt.price
    FROM dormitory d
    LEFT JOIN dormitory_info di ON d.dormitory_id = di.dormitory_id
    LEFT JOIN facilities f ON d.dormitory_id = f.dormitory_id
    LEFT JOIN room r ON d.dormitory_id = r.dormitory_id
    LEFT JOIN room_type rt ON r.room_type_id = rt.room_type_id
    WHERE d.dormitory_id = ?`;

  db.all(query, [dormitory_id], (err, rows) => {
    if (err) {
      console.log(err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    if (!rows || rows.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลหอพัก");
    }

    // ดึงข้อมูลหอพักจาก row แรก
    let dormData = {
      dormitory_id: rows[0].dormitory_id,
      dorm_name: rows[0].dormitory_name,
      dorm_address: `${rows[0].dorm_address}, ${rows[0].subdistrict}, ${rows[0].district}, ${rows[0].province}, ${rows[0].zip_code}`,
      information: [],
      gallery: [],
      facilities: [],
      rooms: [],
    };

    // วนลูปเพิ่มข้อมูลรายละเอียด
    rows.forEach((row) => {
      if (row.information && !dormData.information.includes(row.information)) {
        dormData.information.push(row.information);
      }
    });

    // วนลูปเพิ่มรูปภาพทั้งหมด
    rows.forEach((row) => {
      if (row.dorm_pic) {
        let imageBase64 = `data:image/jpeg;base64,${Buffer.from(
          row.dorm_pic
        ).toString("base64")}`;
        if (!dormData.gallery.includes(imageBase64)) {
          dormData.gallery.push(imageBase64);
        }
      }
    });

    // วนลูปเพิ่มข้อมูลสิ่งอำนวยความสะดวก
    rows.forEach((row) => {
      if (row.facility && !dormData.facilities.includes(row.facility)) {
        dormData.facilities.push(row.facility);
      }
    });

    // วนลูปเพิ่มข้อมูลห้องพัก
    rows.forEach((row) => {
      if (
        row.room_id &&
        !dormData.rooms.some((r) => r.room_id === row.room_id)
      ) {
        dormData.rooms.push({
          room_id: row.room_id,
          room_type: row.room_type_name,
          price: row.price,
        });
      }
    });

    console.log(dormData);
    res.render("tenant", { data: dormData, user: req.session.user });
  });
});

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Route for the home page
app.get('/', (req, res) => {
  if (req.session.user) {
      return res.render('home', { user: req.session.user }); // Render หน้า home ถ้ามี session
  }
  res.render('start'); // ถ้าไม่มี session ให้แสดงหน้าเริ่มต้น (start)
});

// API route for user registration
app.post("/register", (req, res) => {
  const { username, password, firstName, lastName, telephone, email } =
    req.body;
  let errors = [];

  // ตรวจสอบว่า username, email และ fullname ต้องไม่ซ้ำ และ telephone ต้องเป็นเลข 10 หลัก
  if (!/^[0-9]{10}$/.test(telephone)) {
    errors.push("หมายเลขโทรศัพท์ต้องมี 10 หลัก");
  }

  db.get(
    "SELECT * FROM tenant WHERE tenant_username = ? OR email = ? OR (firstName = ? AND lastName = ?)",
    [username, email, firstName, lastName],
    (err, row) => {
      if (err) {
        console.log(err);
        errors.push("Database error");
      }
      if (row) {
        errors.push("Username, Email หรือ Full Name ถูกใช้ไปแล้ว");
      }

      if (errors.length > 0) {
        return res.send(
          `<script>alert("${errors.join(
            "\\n"
          )}"); window.location.href = "/";</script>`
        );
      }

      // ถ้าผ่านเงื่อนไข ให้ INSERT ลงฐานข้อมูล
      db.run(
        "INSERT INTO tenant (tenant_username, tenant_password, firstName, lastName, telephone, email) VALUES (?, ?, ?, ?, ?, ?)",
        [username, password, firstName, lastName, telephone, email],
        function (err) {
          if (err) {
            console.log(err, "cannot insert user");
            return res.send(
              '<script>alert("Database error"); window.location.href = "/";</script>'
            );
          }
          console.log("Insert user success");
          res.send(
            '<script>alert("User registered successfully"); window.location.href = "/";</script>'
          );
        }
      );
    }
  );
});

app.get("/banks/:bill_id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }

  const billId = req.params.bill_id;
  const query = `SELECT bank_account_number, bank_account_name, bank_name, bank_pic FROM bank`;

  db.all(query, [], (err, banks) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลธนาคาร");
    }

    // ✅ แปลง `BLOB` เป็น `Base64` (ถ้ามีค่า)
    const formattedBanks = banks.map(bank => {
      let bankPicBase64 = "";
      if (bank.bank_pic) {
        bankPicBase64 = `data:image/png;base64,${bank.bank_pic.toString("base64")}`;
      } else {
        bankPicBase64 = "/default-bank-logo.png"; // รูป Default ถ้าไม่มีค่า
      }

      return {
        bank_account_number: bank.bank_account_number,
        bank_account_name: bank.bank_account_name,
        bank_name: bank.bank_name,
        bank_pic: bankPicBase64
      };
    });

    res.render("select_bank", { user: req.session.user, banks: formattedBanks, bill_id: billId });
  });
});

app.get("/pay/:bank_account_number/:bill_id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }

  const { bank_account_number, bill_id } = req.params;

  const query = `SELECT * FROM bank WHERE bank_account_number = ?`;

  db.get(query, [bank_account_number], (err, bank) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลธนาคาร");
    }

    if (!bank) {
      return res.status(404).send("ไม่พบบัญชีธนาคาร");
    }

    // แปลง `BLOB` เป็น `Base64`
    const bankPic = bank.bank_pic ? `data:image/png;base64,${bank.bank_pic.toString("base64")}` : "/default-bank-logo.png";

    res.render("payment", { user: req.session.user, bank: { ...bank, bank_pic: bankPic }, bill_id });
  });
});

const fs = require("fs");

app.post("/confirm-payment", upload.single("receipt"), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }

  const { bill_id, bank_account_number } = req.body;

  // อ่านไฟล์เป็น Buffer ถ้ามีการอัปโหลด
  const receiptBlob = req.file ? fs.readFileSync(req.file.path) : null;

  const query = `
    UPDATE payment SET bill_status = 2, receipt_pic = ? WHERE bill_id = ?;
  `;

  db.run(query, [receiptBlob, bill_id], (err) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกการชำระเงิน");
    }

    res.redirect("/bill");
  });
});

app.get("/receipt/:bill_id", (req, res) => {
  const { bill_id } = req.params;

  const query = `SELECT receipt_pic FROM payment WHERE bill_id = ?`;

  db.get(query, [bill_id], (err, row) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    if (!row || !row.receipt_pic) {
      return res.status(404).send("ไม่พบรูปภาพสลิป");
    }

    res.setHeader("Content-Type", "image/png");
    res.send(row.receipt_pic);
  });
});


// API route for user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM tenant WHERE tenant_username = ? AND tenant_password = ?", [username, password], (err, row) => {
      if (err) {
          console.log(err);
          return res.status(500).json({ status: 'error', message: 'Database error' });
      }
      if (!row) {
          return res.status(400).json({ status: 'error', message: 'Invalid username or password' });
      }

      // Create a session for the user
      req.session.user = {
          id: row.tenant_ID,
          username: row.tenant_username,
          firstName: row.firstName,
          lastName: row.lastName
      };

      res.status(200).json({ status: 'success', message: 'Login successful' });
  });
});

app.get('/home', (req, res) => {
  if (!req.session.user) {
      return res.redirect('/');
  }
  res.render('home', { user: req.session.user });
});

// Route for the owner login page
app.get('/owner-login', (req, res) => {
  if (req.session.owner) {
      return res.render('owner', { owner: req.session.owner }); // Render หน้า owner ถ้ามี session
  }
  res.render('owner-login'); // ถ้าไม่มี session ให้แสดงหน้า login
});

// API route for owner login
app.post('/owner-login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM owners WHERE owner_username = ? AND owner_password = ?", [username, password], (err, row) => {
      if (err) {
          console.log(err);
          return res.status(500).json({ status: 'error', message: 'Database error' });
      }
      if (!row) {
          return res.status(400).json({ status: 'error', message: 'Invalid owner username or password' });
      }

      // Create a session for the owner
      req.session.owner = {
          id: row.id,
          username: row.owner_username
      };

      res.status(200).json({ status: 'success', message: 'Login successful' });
  });
});

// Route for the owner page
app.get("/owner", (req, res) => {
  if (!req.session.owner) {
    return res.redirect("/owner-login");
  }
  res.render("owner", { owner: req.session.owner });
});

// Route: Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get('/tncontact', (req, res) => {
  if (!req.session.user) {
      return res.redirect('/');
  }

  console.log(req.session.user.id);
  console.log(req.session.user.username);
  const tenantID = req.session.user.id;
  
  const query = `SELECT c.contact_id, c.tenant_ID, c.topic, c.description, c.picture, c.date, c.status, c.response, c.date, d.dormitory_name
  FROM contact c JOIN tenant t ON c.tenant_ID = t.tenant_ID
  JOIN room r ON t.tenant_ID = r.tenant_ID
  JOIN dormitory d ON r.dormitory_id = d.dormitory_id
  WHERE c.tenant_ID = ?`;  // แสดงเฉพาะ tenant_ID ที่ล็อกอิน
  

  db.all(query, [tenantID], (err, rows) => {
      if (err) {
          return res.status(500).send('Database error: ' + err.message);
      }

      res.render('tenantcontact', { contacts: rows, id: req.session.user, user: req.session.user });
  });
});

app.get('/ownercontact', (req, res) => {
  const query = `SELECT c.contact_id, c.tenant_ID, c.topic, c.description, c.picture, c.date, c.status, c.response, c.response_time, t.tenant_ID, r.room_id, d.dormitory_id, d.dormitory_name, d.owner_id
    FROM contact c
    JOIN tenant t ON c.tenant_ID = t.tenant_ID
    JOIN room r ON t.tenant_ID = r.tenant_ID
    JOIN dormitory d ON r.dormitory_id = d.dormitory_id
    ORDER BY c.date DESC`;

  db.all(query, [], (err, rows) => {
      if (err) {
          return res.status(500).send('Database error: ' + err.message);
      }

      // เรนเดอร์หน้า EJS และส่งข้อมูลไป
      res.render('ownercontact', { contacts: rows });
  });
});

app.get('/tenantcontactform', (req, res) => {
  if (!req.session.user) {
      return res.redirect('/');
  }
  res.render('tenantcontactform', { user: req.session.user.username });
});

app.get('/contact/:id', (req, res) => {
  const contactId = req.params.id;
  const query = `SELECT c.contact_id, c.tenant_ID, c.topic, c.description, c.picture, c.date, c.status, c.response, c.response_time, t.tenant_ID, t.firstName, t.lastName, t.telephone, r.room_id, d.dormitory_id, d.dormitory_name, d.owner_id
FROM contact c
JOIN tenant t ON c.tenant_ID = t.tenant_ID
JOIN room r ON t.tenant_ID = r.tenant_ID
JOIN dormitory d ON r.dormitory_id = d.dormitory_id
WHERE c.contact_id = ?`;

  db.get(query, [contactId], (err, row) => {
      if (err) {
          return res.status(500).send('Database error: ' + err.message);
      }
      if (!row) {
          return res.status(404).send('Contact not found');
      }
      if (row.picture) {
          row.picture = `data:image/jpeg;base64,${row.picture.toString('base64')}`;
      }

      if (row.status === 'pending') {
          res.render('ownercontactdetail', { contact: row });
      } else {
          res.render('contactdone', { contact: row });
      }

  });
});

app.get('/tncontact/:id', (req, res) => {
  const contactId = req.params.id;
  const query = `SELECT c.contact_id, c.tenant_ID, c.topic, c.description, c.picture, c.date, c.status, c.response, c.response_time, t.tenant_ID, t.firstName, t.lastName, t.telephone, r.room_id, d.dormitory_id, d.dormitory_name, d.owner_id
FROM contact c
JOIN tenant t ON c.tenant_ID = t.tenant_ID
JOIN room r ON t.tenant_ID = r.tenant_ID
JOIN dormitory d ON r.dormitory_id = d.dormitory_id
WHERE c.contact_id = ?`;

  db.get(query, [contactId], (err, row) => {
      if (err) {
          return res.status(500).send('Database error: ' + err.message);
      }
      if (!row) {
          return res.status(404).send('Contact not found');
      }
      if (row.picture) {
          row.picture = `data:image/jpeg;base64,${row.picture.toString('base64')}`;
      }

      if (row.status === 'pending') {
          res.render('tenantcontactdetail', { contact: row });
      } else {
          res.render('contactdone', { contact: row });
      }

  });
});

app.post('/update-contact', (req, res) => {
  const { contact_id, response } = req.body;
  if (!contact_id || !response) {
      return res.json({ success: false, message: "Missing data" });
  }

  const responseDate = new Date().toISOString();

  const query = `UPDATE contact 
                 SET status = 'resolved', 
                     response = ?, 
                     response_time = ? 
                 WHERE contact_id = ?`;

  db.run(query, [response, responseDate, contact_id], function (err) {
      if (err) {
          console.error("Database Error:", err.message);
          return res.json({ success: false, message: err.message });
      }
      res.json({ success: true });
  });
});

app.post('/submit-contact', upload.single('picture'), (req, res) => {
  if (!req.session.user) {
      return res.redirect('/');
  }
  
  const tenantID = req.session.user.id;
  const { topic, description } = req.body;
  let picture = req.file ? req.file.buffer : null;
  const date = new Date().toISOString();
  const status = 'pending';

  db.get("SELECT contact_id FROM contact ORDER BY contact_id DESC LIMIT 1", (err, row) => {
      if (err) {
          console.error('Database error (SELECT):', err.message);
          return res.status(500).send('Database error (SELECT)');
      }
      
      let newContactId = "C001";
      if (row) {
          let lastId = parseInt(row.contact_id.substring(1));
          newContactId = `C${(lastId + 1).toString().padStart(3, '0')}`;
      }

      const insertQuery = `INSERT INTO contact (contact_id, tenant_ID, topic, description, picture, date, status, response, response_time) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`;

      db.run(insertQuery, [newContactId, tenantID, topic, description, picture, date, status], (err) => {
          if (err) {
              console.error('Database error (INSERT):', err.message);
              return res.status(500).send('Database error (INSERT)');
          }
          console.log("Contact inserted successfully! ID:", newContactId);
          res.redirect('/tncontact');
      });
  });
});

app.listen(port, () => {
  console.log(`Starting node.js at port ${port}`);
});
=======
const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const uuid = require('uuid');
const fs = require('fs');

// Creating the Express server
const app = express();

// Connect to SQLite database
let db = new sqlite3.Database("udee.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});

// Session management
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// static resourse & templating engine
app.use(express.static("public"));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/style", express.static(path.join(__dirname, "style")));
// Set EJS as templating engine
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route สำหรับหน้า bill
app.get("/dorm", function (req, res) {
  res.render('detail', { user: req.session.user });
});

// Route สำหรับหน้า bill
app.get("/bill", function (req, res) {
  if (!req.session.user) {
    return res.redirect('/'); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }
  res.render('bill', { user: req.session.user });
});

// app.get("/", function (req, res) {
//   res.render("home");
// });

app.get("/tenant/:dormitory_id", function (req, res) {
  const dormitory_id = req.params.dormitory_id; // รับค่า dormitory_id จาก URL

  // Query รวมข้อมูลจากหลายตาราง
  const query = `
    SELECT 
      d.dormitory_id, d.dormitory_name, d.dorm_address, d.province, d.district, d.subdistrict, d.zip_code,
      di.information, di.dorm_pic,
      f.facility,
      r.room_id, r.contract_id, r.room_type_id,
      rt.room_type_name, rt.price
    FROM dormitory d
    LEFT JOIN dormitory_info di ON d.dormitory_id = di.dormitory_id
    LEFT JOIN facilities f ON d.dormitory_id = f.dormitory_id
    LEFT JOIN room r ON d.dormitory_id = r.dormitory_id
    LEFT JOIN room_type rt ON r.room_type_id = rt.room_type_id
    WHERE d.dormitory_id = ?`;

  db.all(query, [dormitory_id], (err, rows) => {
    if (err) {
      console.log(err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    if (!rows || rows.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลหอพัก");
    }

    // ดึงข้อมูลหอพักจาก row แรก
    let dormData = {
      dormitory_id: rows[0].dormitory_id,
      dorm_name: rows[0].dormitory_name,
      dorm_address: `${rows[0].dorm_address}, ${rows[0].subdistrict}, ${rows[0].district}, ${rows[0].province}, ${rows[0].zip_code}`,
      information: [],
      gallery: [],
      facilities: [],
      rooms: []
    };

    // วนลูปเพิ่มข้อมูลรายละเอียด
    rows.forEach(row => {
      if (row.information && !dormData.information.includes(row.information)) {
        dormData.information.push(row.information);
      }
    });

    // วนลูปเพิ่มรูปภาพทั้งหมด
    rows.forEach(row => {
      if (row.dorm_pic) {
        let imageBase64 = `data:image/jpeg;base64,${Buffer.from(row.dorm_pic).toString("base64")}`;
        if (!dormData.gallery.includes(imageBase64)) {
          dormData.gallery.push(imageBase64);
        }
      }
    });

    // วนลูปเพิ่มข้อมูลสิ่งอำนวยความสะดวก
    rows.forEach(row => {
      if (row.facility && !dormData.facilities.includes(row.facility)) {
        dormData.facilities.push(row.facility);
      }
    });

    // วนลูปเพิ่มข้อมูลห้องพัก
    rows.forEach(row => {
      if (row.room_id && !dormData.rooms.some(r => r.room_id === row.room_id)) {
        dormData.rooms.push({
          room_id: row.room_id,
          room_type: row.room_type_name,
          price: row.price
        });
      }
    });

    console.log(dormData);
    res.render("tenant", { data: dormData, user: req.session.user });
  });
});

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Route for the home page
app.get('/', (req, res) => {
  res.render('index');
});

// API route for user registration
app.post('/register', (req, res) => {
  const { username, password, firstName, lastName, telephone, email } = req.body;
  let errors = [];

  // ตรวจสอบว่า username, email และ fullname ต้องไม่ซ้ำ และ telephone ต้องเป็นเลข 10 หลัก
  if (!/^[0-9]{10}$/.test(telephone)) {
    errors.push("หมายเลขโทรศัพท์ต้องมี 10 หลัก");
  }

  db.get("SELECT * FROM tenant WHERE tenant_username = ? OR email = ? OR (firstName = ? AND lastName = ?)",
    [username, email, firstName, lastName], (err, row) => {
      if (err) {
        console.log(err);
        errors.push("Database error");
      }
      if (row) {
        errors.push("Username, Email หรือ Full Name ถูกใช้ไปแล้ว");
      }

      if (errors.length > 0) {
        return res.send(`<script>alert("${errors.join('\\n')}"); window.location.href = "/";</script>`);
      }

      // ถ้าผ่านเงื่อนไข ให้ INSERT ลงฐานข้อมูล
      db.run("INSERT INTO tenant (tenant_username, tenant_password, firstName, lastName, telephone, email) VALUES (?, ?, ?, ?, ?, ?)",
        [username, password, firstName, lastName, telephone, email],
        function (err) {
          if (err) {
            console.log(err, 'cannot insert user');
            return res.send('<script>alert("Database error"); window.location.href = "/";</script>');
          }
          console.log('Insert user success');
          res.send('<script>alert("User registered successfully"); window.location.href = "/";</script>');
        }
      );
    }
  );
});

// API route for user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM tenant WHERE tenant_username = ? AND tenant_password = ?", [username, password], (err, row) => {
    if (err) {
      console.log(err);
      return res.send('<script>alert("Database error"); window.location.href = "/";</script>');
    }
    if (!row) {
      return res.send('<script>alert("Invalid username or password"); window.location.href = "/";</script>');
    }

    // Create a session for the user
    req.session.user = {
      id: row.id,
      username: row.tenant_username,
      firstName: row.firstName,
      lastName: row.lastName
    };

    res.redirect('/ref');
  });
});

// Route for the ref page
app.get('/ref', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('home', { user: req.session.user });
});

// Route for the owner login page
app.get('/owner-login', (req, res) => {
  res.render('owner-login');
});

// API route for owner login
app.post('/owner-login', (req, res) => {
  const { username, password } = req.body;

  ownerDb.get("SELECT * FROM owners WHERE owner_username = ? AND owner_password = ?", [username, password], (err, row) => {
    if (err) {
      console.log(err);
      return res.send('<script>alert("Database error"); window.location.href = "/owner-login";</script>');
    }
    if (!row) {
      return res.send('<script>alert("Invalid owner username or password"); window.location.href = "/owner-login";</script>');
    }

    // Create a session for the owner
    req.session.owner = {
      id: row.id,
      username: row.owner_username
    };

    res.redirect('/owner');
  });
});

// Route for the owner page
app.get('/owner', (req, res) => {
  if (!req.session.owner) {
    return res.redirect('/owner-login');
  }
  res.render('owner', { owner: req.session.owner });
});

// Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

//Start usecase 1  เพิ่มข้อมูลหอพัก----------------------------------------------------------------------------------------
// ตั้งค่า multer สำหรับอัปโหลดไฟล์
// Multer configuration for file upload
const storage = multer.memoryStorage(); // เก็บไฟล์ในหน่วยความจำ (Buffer)
const upload = multer({
  storage: storage,
  limits: { files: 5 }, // จำกัดจำนวนไฟล์ที่สามารถอัปโหลดได้สูงสุด 5 ไฟล์
  fileFilter: (req, file, cb) => {  // การกรองไฟล์
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true); // อนุญาตให้ไฟล์ JPEG และ PNG อัปโหลดได้
    } else {
      cb(new Error('Only JPEG and PNG files are allowed'), false); // ถ้าไม่ใช่ไฟล์ JPEG หรือ PNG จะปฏิเสธ
    }
  }
});

// Route for the add_dorm page
app.get('/add_dorm', (req, res) => {
  res.render('add_dorm');
});

app.post('/add_dorm_info', upload.array('image'), function (req, res) {
  // รับค่าข้อมูลจากฟอร์ม
  let formdata = {
    dormitory_name: req.body.dormitory_name,
    contact: req.body.contact,
    email: req.body.email,
    monthly_bill_date: req.body.monthly_bill_date,
    bill_due_date: req.body.bill_due_date,
    floor_count: req.body.floor_count,
    dorm_address: req.body.dorm_address,
    province: req.body.province,
    subdistrict: req.body.subdistrict,
    district: req.body.district,
    zip_code: req.body.zip_code,
    bank_name: req.body.bank_name,  // รับค่าจากฟอร์ม
    bank_account_name: req.body.bank_account_name,  // รับค่าจากฟอร์ม
    bank_account_number: req.body.bank_account_number  // รับค่าจากฟอร์ม
  };

  // ค้นหาค่าของ dormitory_id ล่าสุด (ใช้ฟอร์แมต D001, D002, D003)
  db.get("SELECT dormitory_id FROM dormitory ORDER BY dormitory_id DESC LIMIT 1", (err, row) => {
    if (err) {
      console.error("Error fetching last dormitory_id:", err);
      return res.send("Error fetching last dormitory_id.");
    }

    let dormitory_id = 'D001'; // ค่าเริ่มต้น
    if (row) {
      let lastId = row.dormitory_id;
      let lastNumber = parseInt(lastId.replace('D', ''));
      dormitory_id = `D${(lastNumber + 1).toString().padStart(3, '0')}`;
    }

    // สร้างคำสั่ง SQL สำหรับการเพิ่มข้อมูลหอพัก
    let sql = `INSERT INTO dormitory (dormitory_id, dormitory_name, contact, email, monthly_bill_date, bill_due_date, floor_count, dorm_address, province, subdistrict, district, zip_code) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    db.run(sql, [
      dormitory_id,
      formdata.dormitory_name,
      formdata.contact,
      formdata.email,
      formdata.monthly_bill_date,
      formdata.bill_due_date,
      formdata.floor_count,
      formdata.dorm_address,
      formdata.province,
      formdata.subdistrict,
      formdata.district,
      formdata.zip_code
    ], function (err) {
      if (err) {
        console.error("Error inserting dormitory data:", err);
        return res.send("Error inserting dormitory data.");
      }

      // แสดงข้อมูลที่แทรกไปใน terminal
      console.log("Dormitory Data Inserted Successfully:");
      console.log({
        dormitory_id: dormitory_id,
        dormitory_name: formdata.dormitory_name,
        contact: formdata.contact,
        email: formdata.email,
        monthly_bill_date: formdata.monthly_bill_date,
        bill_due_date: formdata.bill_due_date,
        floor_count: formdata.floor_count,
        dorm_address: formdata.dorm_address,
        province: formdata.province,
        subdistrict: formdata.subdistrict,
        district: formdata.district,
        zip_code: formdata.zip_code
      });

      // เพิ่มข้อมูลบัญชีธนาคาร
      let bankSql = `INSERT INTO bank (bank_account_number, bank_account_name, bank_name) VALUES (?, ?, ?);`;
      db.run(bankSql, [
        formdata.bank_account_number,
        formdata.bank_account_name,
        formdata.bank_name
      ], function (err) {
        if (err) {
          console.error("Error inserting bank data:", err);
          return res.send("Error inserting bank data.");
        }

        // แสดงข้อมูลบัญชีธนาคารที่แทรก
        console.log("Bank Data Inserted Successfully:");
        console.log({
          bank_account_number: formdata.bank_account_number,
          bank_account_name: formdata.bank_account_name,
          bank_name: formdata.bank_name
        });

        // เพิ่มข้อมูลสิ่งอำนวยความสะดวก
        const facilities = req.body.facility || [];
        const facilityInserts = [];
        const facilityValues = [];

        facilities.forEach(facility => {
          const rawUUID = uuid.v4().replace(/-/g, '');
          const facilityID = `FAC-${rawUUID.slice(0, 8)}`;
          facilityInserts.push(`(?, ?, ?)`);
          facilityValues.push(facilityID, dormitory_id, facility);
        });

        if (facilityInserts.length > 0) {
          let facilitySql = `INSERT INTO facilities (facilityID, dormitory_id, facility) VALUES ${facilityInserts.join(", ")};`;

          db.run(facilitySql, facilityValues, function (err) {
            if (err) {
              console.error("Error inserting facility data:", err);
              return res.send("Error inserting facility data.");
            }

            console.log("Facility Data Inserted Successfully:");
            console.log(facilityValues);  // แสดงข้อมูลสิ่งอำนวยความสะดวกที่แทรก
          
            // ตรวจสอบว่ามีการอัปโหลดรูปภาพ
            if (req.files && req.files.length > 0) {
              req.files.forEach(file => {
                const imageBuffer = file.buffer;
                let imageSql = `INSERT INTO dormitory_info (dormitory_id, dorm_pic) VALUES (?, ?);`;
                db.run(imageSql, [dormitory_id, imageBuffer], function (err) {
                  if (err) {
                    console.error("Error inserting image data:", err);
                    return res.send("Error inserting image data.");
                  }
                });
              });

              res.redirect('/dorm');
            } else {
              res.redirect('/dorm');
              return res.send("No picture data.");
            }
          });
        } else {
          res.redirect('/dorm');
        }
      });
    });
  });
});

  //End usecase 1  เพิ่มข้อมูลหอพัก--------------------------------------------------------------------------------------------

  // Route for the add_dorm page
  app.get('/add_bill', (req, res) => {
    res.render('bill_detail');
  });

  app.listen(port, () => {
    console.log(`Starting node.js at port ${port}`);
  });
>>>>>>> 6316e01cc7be00e322a8c79a746e99c99db8293c
=======
const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const uuid = require('uuid');
const fs = require('fs');

// Creating the Express server
const app = express();

// Connect to SQLite database
let db = new sqlite3.Database("udee.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});

// Session management
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// static resourse & templating engine
app.use(express.static("public"));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/style", express.static(path.join(__dirname, "style")));
// Set EJS as templating engine
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route สำหรับหน้า bill
app.get("/dorm", function (req, res) {
  res.render('detail', { user: req.session.user });
});

// Route สำหรับหน้า bill
app.get("/bill", function (req, res) {
  if (!req.session.user) {
    return res.redirect('/'); // ถ้าไม่ได้ login ให้กลับไปหน้าแรก
  }
  res.render('bill', { user: req.session.user });
});

// app.get("/", function (req, res) {
//   res.render("home");
// });

app.get("/tenant/:dormitory_id", function (req, res) {
  const dormitory_id = req.params.dormitory_id; // รับค่า dormitory_id จาก URL

  // Query รวมข้อมูลจากหลายตาราง
  const query = `
    SELECT 
      d.dormitory_id, d.dormitory_name, d.dorm_address, d.province, d.district, d.subdistrict, d.zip_code,
      di.information, di.dorm_pic,
      f.facility,
      r.room_id, r.contract_id, r.room_type_id,
      rt.room_type_name, rt.price
    FROM dormitory d
    LEFT JOIN dormitory_info di ON d.dormitory_id = di.dormitory_id
    LEFT JOIN facilities f ON d.dormitory_id = f.dormitory_id
    LEFT JOIN room r ON d.dormitory_id = r.dormitory_id
    LEFT JOIN room_type rt ON r.room_type_id = rt.room_type_id
    WHERE d.dormitory_id = ?`;

  db.all(query, [dormitory_id], (err, rows) => {
    if (err) {
      console.log(err.message);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    if (!rows || rows.length === 0) {
      return res.status(404).send("ไม่พบข้อมูลหอพัก");
    }

    // ดึงข้อมูลหอพักจาก row แรก
    let dormData = {
      dormitory_id: rows[0].dormitory_id,
      dorm_name: rows[0].dormitory_name,
      dorm_address: `${rows[0].dorm_address}, ${rows[0].subdistrict}, ${rows[0].district}, ${rows[0].province}, ${rows[0].zip_code}`,
      information: [],
      gallery: [],
      facilities: [],
      rooms: []
    };

    // วนลูปเพิ่มข้อมูลรายละเอียด
    rows.forEach(row => {
      if (row.information && !dormData.information.includes(row.information)) {
        dormData.information.push(row.information);
      }
    });

    // วนลูปเพิ่มรูปภาพทั้งหมด
    rows.forEach(row => {
      if (row.dorm_pic) {
        let imageBase64 = `data:image/jpeg;base64,${Buffer.from(row.dorm_pic).toString("base64")}`;
        if (!dormData.gallery.includes(imageBase64)) {
          dormData.gallery.push(imageBase64);
        }
      }
    });

    // วนลูปเพิ่มข้อมูลสิ่งอำนวยความสะดวก
    rows.forEach(row => {
      if (row.facility && !dormData.facilities.includes(row.facility)) {
        dormData.facilities.push(row.facility);
      }
    });

    // วนลูปเพิ่มข้อมูลห้องพัก
    rows.forEach(row => {
      if (row.room_id && !dormData.rooms.some(r => r.room_id === row.room_id)) {
        dormData.rooms.push({
          room_id: row.room_id,
          room_type: row.room_type_name,
          price: row.price
        });
      }
    });

    console.log(dormData);
    res.render("tenant", { data: dormData, user: req.session.user });
  });
});

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Route for the home page
app.get('/', (req, res) => {
  res.render('index');
});

// API route for user registration
app.post('/register', (req, res) => {
  const { username, password, firstName, lastName, telephone, email } = req.body;
  let errors = [];

  // ตรวจสอบว่า username, email และ fullname ต้องไม่ซ้ำ และ telephone ต้องเป็นเลข 10 หลัก
  if (!/^[0-9]{10}$/.test(telephone)) {
    errors.push("หมายเลขโทรศัพท์ต้องมี 10 หลัก");
  }

  db.get("SELECT * FROM tenant WHERE tenant_username = ? OR email = ? OR (firstName = ? AND lastName = ?)",
    [username, email, firstName, lastName], (err, row) => {
      if (err) {
        console.log(err);
        errors.push("Database error");
      }
      if (row) {
        errors.push("Username, Email หรือ Full Name ถูกใช้ไปแล้ว");
      }

      if (errors.length > 0) {
        return res.send(`<script>alert("${errors.join('\\n')}"); window.location.href = "/";</script>`);
      }

      // ถ้าผ่านเงื่อนไข ให้ INSERT ลงฐานข้อมูล
      db.run("INSERT INTO tenant (tenant_username, tenant_password, firstName, lastName, telephone, email) VALUES (?, ?, ?, ?, ?, ?)",
        [username, password, firstName, lastName, telephone, email],
        function (err) {
          if (err) {
            console.log(err, 'cannot insert user');
            return res.send('<script>alert("Database error"); window.location.href = "/";</script>');
          }
          console.log('Insert user success');
          res.send('<script>alert("User registered successfully"); window.location.href = "/";</script>');
        }
      );
    }
  );
});

// API route for user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM tenant WHERE tenant_username = ? AND tenant_password = ?", [username, password], (err, row) => {
    if (err) {
      console.log(err);
      return res.send('<script>alert("Database error"); window.location.href = "/";</script>');
    }
    if (!row) {
      return res.send('<script>alert("Invalid username or password"); window.location.href = "/";</script>');
    }

    // Create a session for the user
    req.session.user = {
      id: row.id,
      username: row.tenant_username,
      firstName: row.firstName,
      lastName: row.lastName
    };

    res.redirect('/ref');
  });
});

// Route for the ref page
app.get('/ref', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('home', { user: req.session.user });
});

// Route for the owner login page
app.get('/owner-login', (req, res) => {
  res.render('owner-login');
});

// API route for owner login
app.post('/owner-login', (req, res) => {
  const { username, password } = req.body;

  ownerDb.get("SELECT * FROM owners WHERE owner_username = ? AND owner_password = ?", [username, password], (err, row) => {
    if (err) {
      console.log(err);
      return res.send('<script>alert("Database error"); window.location.href = "/owner-login";</script>');
    }
    if (!row) {
      return res.send('<script>alert("Invalid owner username or password"); window.location.href = "/owner-login";</script>');
    }

    // Create a session for the owner
    req.session.owner = {
      id: row.id,
      username: row.owner_username
    };

    res.redirect('/owner');
  });
});

// Route for the owner page
app.get('/owner', (req, res) => {
  if (!req.session.owner) {
    return res.redirect('/owner-login');
  }
  res.render('owner', { owner: req.session.owner });
});

// Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

//Start usecase 2  เพิ่มข้อมูลหอพัก----------------------------------------------------------------------------------------
// ตั้งค่า multer สำหรับอัปโหลดไฟล์
// Multer configuration for file upload
const storage = multer.memoryStorage(); // เก็บไฟล์ในหน่วยความจำ (Buffer)
const upload = multer({
  storage: storage,
  limits: { files: 5 }, // จำกัดจำนวนไฟล์ที่สามารถอัปโหลดได้สูงสุด 5 ไฟล์
  fileFilter: (req, file, cb) => {  // การกรองไฟล์
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true); // อนุญาตให้ไฟล์ JPEG และ PNG อัปโหลดได้
    } else {
      cb(new Error('Only JPEG and PNG files are allowed'), false); // ถ้าไม่ใช่ไฟล์ JPEG หรือ PNG จะปฏิเสธ
    }
  }
});

// Route for the add_dorm page
app.get('/add_dorm', (req, res) => {
  res.render('add_dorm');
});

app.post('/add_dorm_info', upload.array('image'), function (req, res) {
  // รับค่าข้อมูลจากฟอร์ม
  let formdata = {
    dormitory_name: req.body.dormitory_name,
    contact: req.body.contact,
    email: req.body.email,
    monthly_bill_date: req.body.monthly_bill_date,
    bill_due_date: req.body.bill_due_date,
    floor_count: req.body.floor_count,
    dorm_address: req.body.dorm_address,
    province: req.body.province,
    subdistrict: req.body.subdistrict,
    district: req.body.district,
    zip_code: req.body.zip_code,
    bank_name: req.body.bank_name,  // รับค่าจากฟอร์ม
    bank_account_name: req.body.bank_account_name,  // รับค่าจากฟอร์ม
    bank_account_number: req.body.bank_account_number  // รับค่าจากฟอร์ม
  };

  // ค้นหาค่าของ dormitory_id ล่าสุด (ใช้ฟอร์แมต D001, D002, D003)
  db.get("SELECT dormitory_id FROM dormitory ORDER BY dormitory_id DESC LIMIT 1", (err, row) => {
    if (err) {
      console.error("Error fetching last dormitory_id:", err);
      return res.send("Error fetching last dormitory_id.");
    }

    let dormitory_id = 'D001'; // ค่าเริ่มต้น
    if (row) {
      let lastId = row.dormitory_id;
      let lastNumber = parseInt(lastId.replace('D', ''));
      dormitory_id = `D${(lastNumber + 1).toString().padStart(3, '0')}`;
    }

    // สร้างคำสั่ง SQL สำหรับการเพิ่มข้อมูลหอพัก
    let sql = `INSERT INTO dormitory (dormitory_id, dormitory_name, contact, email, monthly_bill_date, bill_due_date, floor_count, dorm_address, province, subdistrict, district, zip_code) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    db.run(sql, [
      dormitory_id,
      formdata.dormitory_name,
      formdata.contact,
      formdata.email,
      formdata.monthly_bill_date,
      formdata.bill_due_date,
      formdata.floor_count,
      formdata.dorm_address,
      formdata.province,
      formdata.subdistrict,
      formdata.district,
      formdata.zip_code
    ], function (err) {
      if (err) {
        console.error("Error inserting dormitory data:", err);
        return res.send("Error inserting dormitory data.");
      }

      // แสดงข้อมูลที่แทรกไปใน terminal
      console.log("Dormitory Data Inserted Successfully:");
      console.log({
        dormitory_id: dormitory_id,
        dormitory_name: formdata.dormitory_name,
        contact: formdata.contact,
        email: formdata.email,
        monthly_bill_date: formdata.monthly_bill_date,
        bill_due_date: formdata.bill_due_date,
        floor_count: formdata.floor_count,
        dorm_address: formdata.dorm_address,
        province: formdata.province,
        subdistrict: formdata.subdistrict,
        district: formdata.district,
        zip_code: formdata.zip_code
      });

      // เพิ่มข้อมูลบัญชีธนาคาร
      let bankSql = `INSERT INTO bank (bank_account_number, bank_account_name, bank_name) VALUES (?, ?, ?);`;
      db.run(bankSql, [
        formdata.bank_account_number,
        formdata.bank_account_name,
        formdata.bank_name
      ], function (err) {
        if (err) {
          console.error("Error inserting bank data:", err);
          return res.send("Error inserting bank data.");
        }

        // แสดงข้อมูลบัญชีธนาคารที่แทรก
        console.log("Bank Data Inserted Successfully:");
        console.log({
          bank_account_number: formdata.bank_account_number,
          bank_account_name: formdata.bank_account_name,
          bank_name: formdata.bank_name
        });

        // เพิ่มข้อมูลสิ่งอำนวยความสะดวก
        const facilities = req.body.facility || [];
        const facilityInserts = [];
        const facilityValues = [];

        facilities.forEach(facility => {
          const rawUUID = uuid.v4().replace(/-/g, '');
          const facilityID = `FAC-${rawUUID.slice(0, 8)}`;
          facilityInserts.push(`(?, ?, ?)`);
          facilityValues.push(facilityID, dormitory_id, facility);
        });

        if (facilityInserts.length > 0) {
          let facilitySql = `INSERT INTO facilities (facilityID, dormitory_id, facility) VALUES ${facilityInserts.join(", ")};`;

          db.run(facilitySql, facilityValues, function (err) {
            if (err) {
              console.error("Error inserting facility data:", err);
              return res.send("Error inserting facility data.");
            }

            console.log("Facility Data Inserted Successfully:");
            console.log(facilityValues);  // แสดงข้อมูลสิ่งอำนวยความสะดวกที่แทรก

            // ตรวจสอบว่ามีการอัปโหลดรูปภาพ
            if (req.files && req.files.length > 0) {
              req.files.forEach(file => {
                const imageBuffer = file.buffer;
                let imageSql = `INSERT INTO dormitory_info (dormitory_id, dorm_pic) VALUES (?, ?);`;
                db.run(imageSql, [dormitory_id, imageBuffer], function (err) {
                  if (err) {
                    console.error("Error inserting image data:", err);
                    return res.send("Error inserting image data.");
                  }
                });
              });

              res.redirect('/dorm');
            } else {
              res.redirect('/dorm');
              return res.send("No picture data.");
            }
          });
        } else {
          res.redirect('/dorm');
        }
      });
    });
  });
});

//End usecase 2  เพิ่มข้อมูลหอพัก--------------------------------------------------------------------------------------------
// 🟢 แสดงบิลของแต่ละห้อง
app.get('/bills/:room_id', async (req, res) => {
  try {
      const room_id = req.params.room_id;

      // ดึงข้อมูลบิลของห้องที่เลือก
      db.get("SELECT * FROM bill WHERE room_id = ?", [room_id], (err, billData) => {
          if (err || !billData) {
              return res.status(404).send("ไม่พบข้อมูลบิล");
          }

          // ดึงข้อมูลสัญญาเช่าของห้อง
          db.get("SELECT * FROM contract WHERE room_id = ?", [room_id], (err, contractData) => {
              if (err || !contractData) {
                  return res.status(404).send("ไม่พบข้อมูลสัญญาเช่า");
              }

              // ดึงข้อมูลผู้เช่า
              db.get("SELECT * FROM tenant WHERE tenant_ID = ?", [contractData.user_citizen_id], (err, tenantData) => {
                  if (err || !tenantData) {
                      return res.status(404).send("ไม่พบข้อมูลผู้เช่า");
                  }

                  // คำนวณยอดรวม
                  let totalAmount = parseFloat(billData.rent_fee) +
                      parseFloat(billData.water_bill) +
                      parseFloat(billData.electricity_bill) +
                      parseFloat(billData.additional_expenses) +
                      parseFloat(billData.fine);

                  // เรนเดอร์หน้า bills.ejs พร้อมส่งข้อมูล
                  res.render('bills', {
                      room_id: room_id,
                      tenantFirstName: contractData.tenantFirstName,
                      tenantLastName: contractData.tenantLastName,
                      telephone: tenantData.telephone,
                      bill_id: billData.bill_id,
                      rent_fee: billData.rent_fee,
                      water_bill: billData.water_bill,
                      electricity_bill: billData.electricity_bill,
                      additional_expenses: billData.additional_expenses,
                      fine: billData.fine,
                      totalAmount: totalAmount.toFixed(2)
                  });
              });
          });
      });
  } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).send("เกิดข้อผิดพลาดในเซิร์ฟเวอร์");
  }
});

// 🟢 API สำหรับเพิ่มรายการเพิ่มเติมลงในบิล
app.post('/api/add-expense', async (req, res) => {
  const { detail, amount, bill_id } = req.body;

  if (!detail || !amount || !bill_id) {
      return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
      db.run("UPDATE bill SET additional_expenses = additional_expenses + ? WHERE bill_id = ?", 
          [parseFloat(amount), bill_id], 
          (err) => {
              if (err) {
                  return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มค่าใช้จ่าย" });
              }
              res.json({ success: true, message: "เพิ่มค่าใช้จ่ายสำเร็จ" });
          }
      );
  } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
  }
});

//End usecase 1 แจ้งค่าเช่ารายเดือนและบริการอื่นๆ ------------------------------------------------------------------------------------

app.listen(port, () => {
  console.log(`Starting node.js at port ${port}`);
});
>>>>>>> Stashed changes
