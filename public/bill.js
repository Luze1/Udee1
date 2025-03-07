let currentBillId = null; // เก็บ bill_id ปัจจุบัน

function openBillModal(billId) {
  currentBillId = billId;
  console.log("เปิด Modal สำหรับบิล ID:", billId);

  $("#billModal").modal("show");

  $.ajax({
    url: "/bill/detail/" + billId,
    method: "GET",
    dataType: "json",
    success: function (data) {
      console.log("ข้อมูลบิลที่โหลด:", data);

      let totalAmount = 0;
      let statusText = "";

      if (data.bill_status == 1) {
        statusText = "<span class='badge bg-success'>✅ ชำระแล้ว</span>";
      } else if (data.bill_status == 2) {
        statusText =
          "<span class='badge bg-warning text-dark'>⏳ กำลังดำเนินการ</span>";
      } else {
        statusText = "<span class='badge bg-danger'>❌ ค้างชำระ</span>";
      }

      let content = `
            <h5>${new Date(data.payment_due_date).toLocaleString("th-TH", {
              month: "long",
              year: "numeric",
            })}</h5>
            <p>${statusText}</p>
            <table class='table'>
                <thead>
                    <tr><th>รายการ</th><th>จำนวนเงิน</th></tr>
                </thead>
                <tbody>`;

      data.items.forEach((item) => {
        totalAmount += item.amount;
        content += `<tr><td>${item.item_name}</td><td>${item.amount} บาท</td></tr>`;
      });

      content += `
                <tr class="fw-bold">
                    <td>รวมค่าใช้จ่ายทั้งหมด</td>
                    <td>${totalAmount} บาท</td>
                </tr>
                </tbody>
            </table>`;

      // ✅ แสดงรูปสลิปโอนเงิน ถ้ามี
      if (data.receipt_pic) {
        content += `
                  <div class="text-center mt-3">
                      <h6>สลิปการโอนเงิน</h6>
                      <img src="${data.receipt_pic}" alt="สลิปการโอนเงิน" 
                           class="img-fluid rounded shadow" style="max-width: 300px;">
                  </div>`;
      }

      $("#billDetailContent").html(content);
    },
  });
}

// ✅ ฟังก์ชันกดปุ่มแล้วไปที่หน้าชำระเงิน
function goToPayment() {
  if (currentBillId) {
    console.log("ไปที่หน้าธนาคารสำหรับ bill_id:", currentBillId); // Debugging
    window.location.href = "/banks/" + currentBillId;
  } else {
    console.log("bill_id ไม่ถูกต้อง");
  }
}
