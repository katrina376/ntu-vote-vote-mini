function generateVoucher_(ballots) {
  var table = fetchSheetRange_(DB_ID, 'vouchers', 'A', 'A');
  var conditions = {
    'code': {
      'value': voucher,
    },
  }
  
  var voucher = randomString_(VOUCHER_LENGTH, VOUCHER_CHAR);
  
  while (true) {
    var conditions = {
      'code': {'value': '\'' + voucher},
    }
    var exist = fetchCells_(table, conditions, 'code');
    
    if (exist.length === 0) {
      addVoucher_(voucher, ballots);
      break;
    } else {
      voucher = randomString_(VOUCHER_LENGTH, VOUCHER_CHAR);
      continue;
    }
  }
  
  return voucher;
}

function addVoucher_(voucher, ballots) {
  var app = SpreadsheetApp.openById(DB_ID);
  var sheet = app.getSheetByName('vouchers');
  
  var record = ballots.join(',');
  
  var lock = LockService.getScriptLock();
  lock.waitLock(150000);
  
  var n = sheet.getLastRow() + 1
  sheet.appendRow(['\'' + voucher, record, '=COUNTIF(\'vouchers-used\'!A:A,A' + n + ')<>0']);
  SpreadsheetApp.flush();
  
  lock.releaseLock();
  
  return;
}

function addRedeemRecord_(voucher) {
  var app = SpreadsheetApp.openById(DB_ID);
  var sheet = app.getSheetByName('vouchers-used');
  
  var lock = LockService.getScriptLock();
  lock.waitLock(150000);
  
  sheet.appendRow(['\'' + voucher]);
  SpreadsheetApp.flush();
  
  lock.releaseLock();
  return;
}

function fetchVoucher_(voucher) {
  var table = fetchSheetRange_(DB_ID, 'vouchers', 'A', 'C');
  var conditions = {
    'code': {
      'value': voucher,
    },
    'is_used': {
      'value': false,
      'type': Boolean,
    }
  }
  
  var list = fetchCells_(table, conditions, 'assigned_ballot_ids');
  
  return list;
}

function fetchBallots_(ballotStr) {
  var ret = [];
  
  var ballots = ballotStr.split(',')
  var table = fetchSheetRange_(DB_ID, 'ballot-types', 'A', 'B')
  var ids = fetchColumn_(table, 'id');
  var displayNames = fetchColumn_(table, 'display_name');
  
  ballots.forEach(function(elm) {
    var idx = ids.indexOf(elm);
    if (idx > -1) {
      ret.push({'id': elm, 'displayName':  displayNames[idx]});
    }
  })
  
  return ret;
}

function filterBallots_(ballots) {
  var ret = [];
  
  var table = fetchSheetRange_(DB_ID, 'ballot-types', 'A', 'B')
  var ids = fetchColumn_(table, 'id');
  var displayNames = fetchColumn_(table, 'display_name');
  
  ballots.forEach(function(elm) {
    var idx = ids.indexOf(elm);
    if (idx > -1) {
      ret.push(elm);
    }
  });
  
  return ret;
}