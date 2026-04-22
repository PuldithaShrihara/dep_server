/** Roles that may edit plans for an assigned department (legacy + new names). */
const DEPARTMENT_HEAD_ROLES = ['DepartmentHead', 'Manager', 'DeptHead'];

function isAdminRole(role) {
    return role === 'Admin';
}

function isDepartmentHeadRole(role) {
    return DEPARTMENT_HEAD_ROLES.includes(role);
}

function isViewOnlyRole(role) {
    return role === 'User';
}

function canEditPlansForDepartment(user) {
    if (!user || user.status === 'Inactive') return false;
    if (isAdminRole(user.role)) return true;
    if (isViewOnlyRole(user.role)) return false;
    if (isDepartmentHeadRole(user.role)) return Boolean(user.department);
    return false;
}

function canViewAdminArea(user) {
    if (!user || user.status === 'Inactive') return false;
    if (isAdminRole(user.role)) return true;
    if (isDepartmentHeadRole(user.role)) {
        return user.department === 'Admin';
    }
    return false;
}

module.exports = {
    DEPARTMENT_HEAD_ROLES,
    isAdminRole,
    isDepartmentHeadRole,
    isViewOnlyRole,
    canEditPlansForDepartment,
    canViewAdminArea
};
