import app from "../app.js";
import { connectDb, disconnectDb } from "../config/db.js";
import { Pharmacy, User, Staff, Medicine, Inventory, Transaction, Alert, Prediction, Otp } from "../models/index.js";
import { emailService, MockEmailProvider } from "../services/emailService.js";
import logger from "../utils/logger.js";

const PORT = 5051;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

async function runTests() {
  logger.info({ message: "Starting concurrency integration tests on MongoDB..." });

  emailService.setProvider(new MockEmailProvider());
  emailService.clearSentEmails();

  // Connect to DB
  await connectDb();
  
  const cleanUp = async () => {
    const pharm = await Pharmacy.findOne({ slug: "concurrency-test-pharmacy" });
    if (pharm) {
      const pId = pharm._id;
      await Promise.all([
        Prediction.deleteMany({ pharmacyId: pId }),
        Alert.deleteMany({ pharmacyId: pId }),
        Transaction.deleteMany({ pharmacyId: pId }),
        Inventory.deleteMany({ pharmacyId: pId }),
        Medicine.deleteMany({ pharmacyId: pId }),
        Staff.deleteMany({ pharmacyId: pId }),
        User.deleteMany({ pharmacyId: pId }),
        Pharmacy.deleteOne({ _id: pId })
      ]);
    }
    await Otp.deleteMany({});
  };

  // Clean test tenant data
  await cleanUp();

  // Start the server
  const server = app.listen(PORT, async () => {
    logger.info({ message: `Test server listening on port ${PORT}` });

    try {
      // 1. Request Registration OTP
      await fetch(`${BASE_URL}/auth/send-registration-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Admin",
          email: "test-concurrency@admin.com",
          pharmacyId: "concurrency-test-pharmacy"
        })
      });
      const otp = emailService.getLastSentEmail()?.metadata?.otp;

      // 1. Register test admin for concurrency-test-pharmacy with verified OTP
      const testAdminPassword = "TestConcurrencyAdmin123!";
      const registerRes = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Admin",
          email: "test-concurrency@admin.com",
          password: testAdminPassword,
          role: "Admin",
          pharmacyId: "concurrency-test-pharmacy",
          otp
        })
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(`Registration failed: ${registerData.message}`);

      // 2. Login to retrieve token
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-concurrency@admin.com",
          password: testAdminPassword,
          pharmacyId: "concurrency-test-pharmacy"
        })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(`Login failed: ${loginData.message}`);
      const token = loginData.data.accessToken;

      // Request OTP for staff creation
      await fetch(`${BASE_URL}/staff/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "create" })
      });
      const staffOtp = emailService.getLastSentEmail()?.metadata?.otp;

      // 3. Create a Staff member with OTP
      const staffRes = await fetch(`${BASE_URL}/staff`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: "Test Pharmacist",
          email: "pharmacist-concurrency@test.com",
          position: "Employee",
          department: "Dispensing",
          salary: 30000,
          joinDate: new Date().toISOString(),
          otp: staffOtp
        })
      });
      const staffData = await staffRes.json();
      if (!staffRes.ok) throw new Error(`Staff creation failed: ${staffData.message}`);
      const staffId = staffData.data.id;

      // 4. Create an Inventory Batch with 10 items
      const inventoryRes = await fetch(`${BASE_URL}/inventory`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: "Concurrency Drug",
          brand: "TestBrand",
          buyingPrice: 10,
          sellingPrice: 20,
          batchNumber: "B-CONC-1",
          currentStock: 10,
          reorderLevel: 2,
          expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 100).toISOString()
        })
      });
      const inventoryData = await inventoryRes.json();
      if (!inventoryRes.ok) throw new Error(`Inventory batch creation failed: ${inventoryData.message}`);
      const inventoryId = inventoryData.data.id;

      // 5. Fire 15 concurrent sell requests in parallel
      logger.info({ message: "Firing 15 concurrent sale requests for 10 available stock..." });
      
      const sellPromises = Array.from({ length: 15 }).map(() =>
        fetch(`${BASE_URL}/inventory/sell`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            inventoryId,
            quantity: 1,
            employeeId: staffId,
            note: "Concurrency sell test"
          })
        })
      );

      const responses = await Promise.all(sellPromises);
      
      let successCount = 0;
      let failureCount = 0;
      const errorMessages = [];

      for (const res of responses) {
        const body = await res.json();
        if (res.ok) {
          successCount++;
        } else {
          failureCount++;
          errorMessages.push(body.message);
        }
      }

      logger.info({ message: `Results - Success: ${successCount}, Failures: ${failureCount}` });
      logger.info({ message: `Unique failure messages: ${[...new Set(errorMessages)].join(", ")}` });

      // 6. Assertions
      if (successCount !== 10) {
        throw new Error(`Concurrency check failed: Expected exactly 10 successes, got ${successCount}`);
      }
      if (failureCount !== 5) {
        throw new Error(`Concurrency check failed: Expected exactly 5 failures, got ${failureCount}`);
      }

      // 7. Verify stock level remains exactly 0
      const getInventoryRes = await fetch(`${BASE_URL}/inventory`, {
        method: "GET",
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });
      const getInventoryData = await getInventoryRes.json();
      const updatedBatch = getInventoryData.data.find(b => b.id === inventoryId);
      
      if (updatedBatch && updatedBatch.currentStock !== 0) {
        throw new Error(`Concurrency check failed: Expected stock to be 0, but it is ${updatedBatch.currentStock}`);
      }

      // 8. Verify employee sales totals (10 sales * 20 sellingPrice = 200 total sales)
      const getStaffRes = await fetch(`${BASE_URL}/staff`, {
        method: "GET",
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });
      const getStaffData = await getStaffRes.json();
      const updatedStaff = getStaffData.data.find(s => s.id === staffId);
      
      if (updatedStaff && updatedStaff.totalSales !== 200) {
        throw new Error(`Staff sales verification failed: Expected total sales to be 200, got ${updatedStaff.totalSales}`);
      }

      logger.info({ message: "CONCURRENCY TEST PASSED SUCCESSFULLY! All MongoDB atomic stock operations validated." });
      
    } catch (err) {
      logger.error({ message: `TEST FAILED: ${err.message}` });
      process.exitCode = 1;
    } finally {
      // Clean up databases
      try {
        await cleanUp();
      } catch (cleanErr) {
        logger.error({ message: `Clean up failed: ${cleanErr.message}` });
      }
      
      server.close(async () => {
        logger.info({ message: "Test server closed. Exiting." });
        await disconnectDb();
      });
    }
  });
}

runTests();
