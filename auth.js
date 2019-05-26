function authenticate_(username, password) {
  var table = fetchSheetRange_(DB_ID, 'booths', 'A', 'D');

  var conditions = {
    'username': {
      'value': username
    }
  }

  if (!fetchCell_(table, conditions, 'username')) {
    throw displayError_('USERNAME_INVALID');
  } else if (fetchCell_(table, conditions, 'password') !== password) {
    throw displayError_('WRONG_PASSWORD');
  } else {
    return {
      'displayName': fetchCell_(table, conditions, 'display_name'),
      'id': fetchCell_(table, conditions, 'id'),
    }
  }
}

function isUnlocker_(id, unlocker) {
  var table = fetchSheetRange_(DB_ID, 'booths', 'A', 'E');

  var conditions = {
    'id': {
      'value': id,
    }
  }
  
  return fetchCell_(table, conditions, 'unlocker') == unlocker;
}


function grant_(token, func) {
  var auth = CacheService.getScriptCache().get(token);
  if (auth) {
    /* Cache remains valid */
    var parsed = JSON.parse(auth);
    return func(parsed);
  } else {
    /* Cache is cleared for some reason; check out spreadsheet */
    var table = fetchSheetRange_(SYS_DB_ID, 'tokens', 'A', 'F');
    var conditions = {
      'token': {
        'value': token,
      },
      'is_valid': {
        'value': true,
        'type': Boolean,
      },
      'time': {
        'value': Date.now() - TOKEN_VALID_TIME * 1000,
        'type': function(s) {return new Date(s)},
        'operator': function(a, b) {return a.getTime() > b},
      }
    }
    
    var content = fetchCell_(table, conditions, 'content');
    if (content) {
      var parsed = JSON.parse(content);
      return func(parsed);
    } else {
      return {
        'status': 403,
        'error': displayError_('UNAUTHORIZED'),
      };
    }
  }
}

function updateSecret_(parent, payloads) {
  var content = JSON.stringify(payloads);
  var token = randomString_(TOKEN_LENGTH, TOKEN_CHAR);
  
  var app = SpreadsheetApp.openById(SYS_DB_ID);
  var sheet = app.getSheetByName('tokens');
  
  var lock = LockService.getScriptLock();
  lock.waitLock(150000);
  
  var n = sheet.getLastRow() + 1; // the row number after append
  var validator = (
    '=AND(' +
    'COUNTIF(B$2:B,A'+ n +')=0,'+
    'COUNTIFS(B'+ n +':B,"LOGIN",C' + n + ':C,C'+ n +')<=' + ALLOW_LOGIN_NUMBER + ',' +
    'D' + n + '+TIME(0,' + TOKEN_VALID_TIME + ',0)>NOW()'+
    ')'
  );
  
  sheet.appendRow([token, parent, payloads.booth.id, new Date(), validator, content]);
  SpreadsheetApp.flush();
  
  lock.releaseLock();
  
  CacheService.getScriptCache().remove(parent);
  CacheService.getScriptCache().put(
    token,
    content,
    TOKEN_CACHE_TIME
  );

  return token;
};
