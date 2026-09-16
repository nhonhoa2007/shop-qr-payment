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
          { code: '20525', name: 'Phường 25' },
        ],
      },
      {
        id: 1450,
        name: 'Quận 7',
        wards: [
          { code: '20801', name: 'Phường Tân Phong' },
          { code: '20802', name: 'Phường Tân Phú' },
          { code: '20803', name: 'Phường Tân Quy' },
        ],
      },
      {
        id: 1452,
        name: 'TP. Thủ Đức',
        wards: [
          { code: '20901', name: 'Phường Thảo Điền' },
          { code: '20902', name: 'Phường An Phú' },
          { code: '20910', name: 'Phường Linh Trung' },
          { code: '20915', name: 'Phường Hiệp Phú' },
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
        name: 'Quận Hoàn Kiếm',
        wards: [
          { code: '100101', name: 'Phường Hàng Bạc' },
          { code: '100102', name: 'Phường Hàng Trống' },
          { code: '100103', name: 'Phường Tràng Tiền' },
          { code: '100104', name: 'Phường Cửa Đông' },
        ],
      },
      {
        id: 1488,
        name: 'Quận Cầu Giấy',
        wards: [
          { code: '100801', name: 'Phường Dịch Vọng' },
          { code: '100802', name: 'Phường Dịch Vọng Hậu' },
          { code: '100803', name: 'Phường Mai Dịch' },
          { code: '100804', name: 'Phường Nghĩa Tân' },
        ],
      },
      {
        id: 1485,
        name: 'Quận Đống Đa',
        wards: [
          { code: '100501', name: 'Phường Láng Thượng' },
          { code: '100502', name: 'Phường Ô Chợ Dừa' },
          { code: '100503', name: 'Phường Văn Miếu' },
        ],
      },
      {
        id: 1484,
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
];
