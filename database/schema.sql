CREATE TABLE Employees (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  firstName NVARCHAR(100) NOT NULL DEFAULT '',
  lastName NVARCHAR(100) NOT NULL DEFAULT '',
  fullName NVARCHAR(200) NOT NULL,
  email NVARCHAR(255) NOT NULL UNIQUE,
  title NVARCHAR(200) NOT NULL DEFAULT '',
  employeeRegion NVARCHAR(120) NOT NULL DEFAULT '',
  supervisorName NVARCHAR(200) NOT NULL DEFAULT '',
  employeeCell NVARCHAR(60) NOT NULL DEFAULT '',
  country NVARCHAR(120) NOT NULL DEFAULT '',
  titleCode NVARCHAR(80) NOT NULL DEFAULT '',
  hireDate DATE NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_Employees_Email ON Employees(email);
CREATE INDEX IX_Employees_FullName ON Employees(fullName);
CREATE INDEX IX_Employees_EmployeeRegion ON Employees(employeeRegion);
CREATE INDEX IX_Employees_Country ON Employees(country);
CREATE INDEX IX_Employees_SupervisorName ON Employees(supervisorName);
CREATE INDEX IX_Employees_TitleCode ON Employees(titleCode);
