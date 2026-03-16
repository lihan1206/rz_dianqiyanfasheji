export const projectStatusOptions = [
  { label: "规划中", value: "PLANNING" },
  { label: "进行中", value: "IN_PROGRESS" },
  { label: "已完成", value: "COMPLETED" },
  { label: "已归档", value: "ARCHIVED" }
];

export const reviewStatusOptions = [
  { label: "待审核", value: "PENDING" },
  { label: "已通过", value: "APPROVED" },
  { label: "已驳回", value: "REJECTED" }
];

export const roleOptions = [
  { label: "管理员", value: "ADMIN" },
  { label: "工程师", value: "ENGINEER" },
  { label: "项目经理", value: "MANAGER" },
  { label: "审核员", value: "REVIEWER" },
  { label: "采购", value: "PURCHASER" }
];

export const roleLabelMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.label]));
export const projectStatusLabelMap = Object.fromEntries(
  projectStatusOptions.map((item) => [item.value, item.label])
);
export const reviewStatusLabelMap = Object.fromEntries(
  reviewStatusOptions.map((item) => [item.value, item.label])
);
