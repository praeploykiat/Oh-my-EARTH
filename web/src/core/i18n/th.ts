import type { MessageKey } from './en';

export const th: Record<MessageKey, string> = {
  'app.title': 'นักสืบแนวโน้มโลก',
  'nav.experience': 'ประสบการณ์',
  'nav.workbench': 'โต๊ะนักสืบ',
  'language.label': 'ภาษา',

  'status.loading': 'กำลังโหลด…',
  'chart.noData': 'ไม่มีข้อมูล',

  'trend.rising': 'เพิ่มขึ้น {value} {unit} ต่อทศวรรษ',
  'trend.falling': 'ลดลง {value} {unit} ต่อทศวรรษ',
  'trend.flat': 'ไม่เปลี่ยนแปลง',
  'trend.pBelow': 'p < 0.001',
  'trend.pValue': 'p = {value}',
  'trend.significant': 'มีนัยสำคัญที่ α = {alpha}',
  'trend.notSignificant': 'ไม่มีนัยสำคัญ',
  'trend.synthetic': 'ข้อมูลตัวอย่างสังเคราะห์',

  'experience.title': 'ประสบการณ์',
  'experience.placeholder': 'พื้นที่สำหรับเรื่องเล่าแบบโต้ตอบ ดีไซน์กำลังพัฒนา',
  'experience.start': 'เริ่ม',
  'experience.play': 'เล่น',
  'experience.playPlaceholder': 'กลไกเกมจะขับเคลื่อนด้วยค่าจากชุดข้อมูล',
  'experience.finish': 'จบ',
  'experience.revealTitle': 'สิ่งที่คุณเพิ่งได้ใช้ชีวิตผ่านมา',
  'experience.playAgain': 'เล่นอีกครั้ง',
  'experience.investigate': 'สืบต่อด้วยตัวเอง',

  'workbench.title': 'โต๊ะนักสืบ',
  'workbench.dataset': 'ชุดข้อมูล',
  'workbench.removeSeasonality': 'ตัดวัฏจักรฤดูกาลออก',
};
