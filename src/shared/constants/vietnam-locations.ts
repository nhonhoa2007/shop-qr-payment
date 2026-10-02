export interface Ward {
  code: string;
  name: string;
}

export interface District {
  id: number;
  name: string;
  wards: Ward[];
}

export interface Province {
  id: string;
  name: string;
  districts: District[];
}

export const VIETNAM_LOCATIONS: Province[] = [
  {
    id: 'hcm',
    name: 'TP. Hồ Chí Minh',
    districts: [
      {
        id: 1442,
        name: 'Quận 1',
        wards: [
          { code: '20101', name: 'Phường Bến Nghé' },
          { code: '20102', name: 'Phường Bến Thành' },
          { code: '20103', name: 'Phường Đa Kao' },
          { code: '20104', name: 'Phường Tân Định' },
          { code: '20109', name: 'Phường Cầu Ông Lãnh' },
        ],
      },
      {
        id: 1444,
        name: 'Quận 3',
        wards: [
          { code: '20301', name: 'Phường Võ Thị Sáu' },
          { code: '20302', name: 'Phường 1' },
          { code: '20303', name: 'Phường 2' },
          { code: '20304', name: 'Phường 3' },
        ],
      },
      {
        id: 1447,
        name: 'Quận Bình Thạnh',
        wards: [
          { code: '20501', name: 'Phường 1' },
          { code: '20502', name: 'Phường 2' },
          { code: '20515', name: 'Phường 15' },
          { code: '20524', name: 'Phường 24' },
        ],
      },
      {
        id: 1451,
        name: 'TP. Thủ Đức',
        wards: [
          { code: '20701', name: 'Phường Thảo Điền' },
          { code: '20702', name: 'Phường An Phú' },
          { code: '20703', name: 'Phường Bình An' },
          { code: '20705', name: 'Phường Thủ Thiêm' },
        ],
      },
      {
        id: 1452,
        name: 'Quận 7',
        wards: [
          { code: '20901', name: 'Phường Tân Phong' },
          { code: '20902', name: 'Phường Tân Phú' },
          { code: '20903', name: 'Phường Tân Quy' },
        ],
      },
      {
        id: 1450,
        name: 'Quận Tân Bình',
        wards: [
          { code: '20801', name: 'Phường 1' },
          { code: '20802', name: 'Phường 2' },
          { code: '20812', name: 'Phường 12' },
        ],
      },
    ],
  },
  {
    id: 'hn',
    name: 'Hà Nội',
    districts: [
      {
        id: 1482,
        name: 'Quận Cầu Giấy',
        wards: [
          { code: '100101', name: 'Phường Dịch Vọng' },
          { code: '100102', name: 'Phường Dịch Vọng Hậu' },
          { code: '100103', name: 'Phường Mai Dịch' },
          { code: '100104', name: 'Phường Nghĩa Đô' },
        ],
      },
      {
        id: 1484,
        name: 'Quận Đống Đa',
        wards: [
          { code: '100201', name: 'Phường Láng Hạ' },
          { code: '100202', name: 'Phường Láng Thượng' },
          { code: '100203', name: 'Phường Ô Chợ Dừa' },
        ],
      },
      {
        id: 1485,
        name: 'Quận Hoàn Kiếm',
        wards: [
          { code: '100301', name: 'Phường Hàng Bạc' },
          { code: '100302', name: 'Phường Hàng Bài' },
          { code: '100303', name: 'Phường Tràng Tiền' },
        ],
      },
      {
        id: 1486,
        name: 'Quận Ba Đình',
        wards: [
          { code: '100401', name: 'Phường Điện Biên' },
          { code: '100402', name: 'Phường Kim Mã' },
          { code: '100403', name: 'Phường Liễu Giai' },
        ],
      },
    ],
  },
  {
    id: 'dn',
    name: 'Đà Nẵng',
    districts: [
      {
        id: 1530,
        name: 'Quận Hải Châu',
        wards: [
          { code: '40101', name: 'Phường Hải Châu 1' },
          { code: '40102', name: 'Phường Thạch Thang' },
          { code: '40103', name: 'Phường Thuận Phước' },
        ],
      },
      {
        id: 1531,
        name: 'Quận Thanh Khê',
        wards: [
          { code: '40201', name: 'Phường An Khê' },
          { code: '40202', name: 'Phường Chính Gián' },
        ],
      },
      // Các quận còn lại của Đà Nẵng: district ID là ID GHN chuẩn (khối 1530-1537).
      // Ward code tạm thời là placeholder tiền tố TMP_ vì chưa có GHN_TOKEN để tra cứu
      // master-data gốc — chạy `npm run ghn:import` khi có token để thay bằng dữ liệu đầy đủ.
      // Nếu gửi mã TMP_ lên GHN API thật, request sẽ lỗi rõ ràng (không âm thầm tính sai phí).
      {
        id: 1532,
        name: 'Quận Sơn Trà',
        wards: [
          { code: 'TMP_1532_1', name: 'Phường Thọ Quang' },
          { code: 'TMP_1532_2', name: 'Phường Nại Hiên Đông' },
          { code: 'TMP_1532_3', name: 'Phường Mân Thái' },
          { code: 'TMP_1532_4', name: 'Phường Phước Mỹ' },
          { code: 'TMP_1532_5', name: 'Phường An Hải' },
        ],
      },
      {
        id: 1533,
        name: 'Quận Ngũ Hành Sơn',
        wards: [
          { code: 'TMP_1533_1', name: 'Phường Mỹ An' },
          { code: 'TMP_1533_2', name: 'Phường Khuê Mỹ' },
          { code: 'TMP_1533_3', name: 'Phường Hòa Hải' },
          { code: 'TMP_1533_4', name: 'Phường Hòa Quý' },
        ],
      },
      {
        id: 1534,
        name: 'Quận Cẩm Lệ',
        wards: [
          { code: 'TMP_1534_1', name: 'Phường Khuê Trung' },
          { code: 'TMP_1534_2', name: 'Phường Hòa Thọ Đông' },
          { code: 'TMP_1534_3', name: 'Phường Hòa Thọ Tây' },
          { code: 'TMP_1534_4', name: 'Phường Hòa Xuân' },
        ],
      },
      {
        id: 1536,
        name: 'Quận Liên Chiểu',
        wards: [
          { code: 'TMP_1536_1', name: 'Phường Hòa Khánh Nam' },
          { code: 'TMP_1536_2', name: 'Phường Hòa Khánh Bắc' },
          { code: 'TMP_1536_3', name: 'Phường Hòa Minh' },
          { code: 'TMP_1536_4', name: 'Phường Hòa Hiệp' },
        ],
      },
      {
        id: 1537,
        name: 'Huyện Hòa Vang',
        wards: [
          { code: 'TMP_1537_1', name: 'Phường Hòa Châu' },
          { code: 'TMP_1537_2', name: 'Phường Hòa Tiến' },
          { code: 'TMP_1537_3', name: 'Phường Hòa Phong' },
          { code: 'TMP_1537_4', name: 'Phường Hòa Nhơn' },
          { code: 'TMP_1537_5', name: 'Phường Hòa Liên' },
          { code: 'TMP_1537_6', name: 'Phường Hòa Phú' },
        ],
      },
    ],
  },
  {
    id: 'ct',
    name: 'Cần Thơ',
    districts: [
      {
        id: 1572,
        name: 'Quận Ninh Kiều',
        wards: [
          { code: '60101', name: 'Phường Tân An' },
          { code: '60102', name: 'Phường An Cư' },
          { code: '60103', name: 'Phường Xuân Khánh' },
        ],
      },
    ],
  },
  {
    id: 'hp',
    name: 'Hải Phòng',
    districts: [
      {
        id: 1510,
        name: 'Quận Hồng Bàng',
        wards: [
          { code: '30101', name: 'Phường Hoàng Văn Thụ' },
          { code: '30102', name: 'Phường Phan Bội Châu' },
        ],
      },
    ],
  },
  {
    id: 'bd',
    name: 'Bình Dương',
    districts: [
      {
        id: 1542,
        name: 'TP. Thủ Dầu Một',
        wards: [
          { code: '50101', name: 'Phường Phú Cường' },
          { code: '50102', name: 'Phường Hiệp Thành' },
        ],
      },
    ],
  },
  {
    id: 'dnai',
    name: 'Đồng Nai',
    districts: [
      {
        id: 1550,
        name: 'TP. Biên Hòa',
        wards: [
          { code: '50201', name: 'Phường Quyết Thắng' },
          { code: '50202', name: 'Phường Thống Nhất' },
        ],
      },
    ],
  },
  {
    id: 'vt',
    name: 'Bà Rịa - Vũng Tàu',
    districts: [
      {
        id: 1560,
        name: 'TP. Vũng Tàu',
        wards: [
          { code: '70101', name: 'Phường 1' },
          { code: '70102', name: 'Phường Thắng Tam' },
          { code: '70103', name: 'Phường Nguyễn An Ninh' },
        ],
      },
      {
        id: 1561,
        name: 'TP. Bà Rịa',
        wards: [
          { code: '70201', name: 'Phường Phước Trung' },
          { code: '70202', name: 'Phường Phước Hiệp' },
        ],
      },
    ],
  },
  {
    id: 'kh',
    name: 'Khánh Hòa',
    districts: [
      {
        id: 1580,
        name: 'TP. Nha Trang',
        wards: [
          { code: '56101', name: 'Phường Lộc Thọ' },
          { code: '56102', name: 'Phường Phước Tiến' },
          { code: '56103', name: 'Phường Vĩnh Hải' },
        ],
      },
    ],
  },
  {
    id: 'ld',
    name: 'Lâm Đồng',
    districts: [
      {
        id: 1590,
        name: 'TP. Đà Lạt',
        wards: [
          { code: '68101', name: 'Phường 1' },
          { code: '68102', name: 'Phường 2' },
          { code: '68110', name: 'Phường 10' },
        ],
      },
    ],
  },
  {
    id: 'hue',
    name: 'Thừa Thiên Huế',
    districts: [
      {
        id: 1520,
        name: 'TP. Huế',
        wards: [
          { code: '46101', name: 'Phường Vĩnh Ninh' },
          { code: '46102', name: 'Phường Phú Nhuận' },
          { code: '46103', name: 'Phường Thuận Thành' },
        ],
      },
    ],
  },
  {
    id: 'qn',
    name: 'Quảng Ninh',
    districts: [
      {
        id: 1600,
        name: 'TP. Hạ Long',
        wards: [
          { code: '22101', name: 'Phường Bãi Cháy' },
          { code: '22102', name: 'Phường Hồng Gai' },
        ],
      },
    ],
  },
  {
    id: 'bn',
    name: 'Bắc Ninh',
    districts: [
      {
        id: 1610,
        name: 'TP. Bắc Ninh',
        wards: [
          { code: '25101', name: 'Phường Suối Hoa' },
          { code: '25102', name: 'Phường Tiền An' },
        ],
      },
    ],
  },
  {
    id: 'na',
    name: 'Nghệ An',
    districts: [
      {
        id: 1630,
        name: 'TP. Vinh',
        wards: [
          { code: '40101', name: 'Phường Lê Mao' },
          { code: '40102', name: 'Phường Quang Trung' },
        ],
      },
    ],
  },
  {
    id: 'th',
    name: 'Thanh Hóa',
    districts: [
      {
        id: 1640,
        name: 'TP. Thanh Hóa',
        wards: [
          { code: '38101', name: 'Phường Ba Đình' },
          { code: '38102', name: 'Phường Điện Biên' },
        ],
      },
    ],
  },
  {
    id: 'tg',
    name: 'Tiền Giang',
    districts: [
      {
        id: 1650,
        name: 'TP. Mỹ Tho',
        wards: [
          { code: '82101', name: 'Phường 1' },
          { code: '82102', name: 'Phường 2' },
        ],
      },
    ],
  },
  {
    id: 'kg',
    name: 'Kiên Giang',
    districts: [
      {
        id: 1680,
        name: 'TP. Rạch Giá',
        wards: [
          { code: '91101', name: 'Phường Vĩnh Thanh Vân' },
        ],
      },
      {
        id: 1681,
        name: 'TP. Phú Quốc',
        wards: [
          { code: '91201', name: 'Phường Dương Đông' },
          { code: '91202', name: 'Phường An Thới' },
        ],
      },
    ],
  },
];
