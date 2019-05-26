function doGet(e) {
  var output = HtmlService.createHtmlOutputFromFile('view');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  output.setTitle('投票系統 - ' + ELECTION_TITLE);
  return output;
}

function doPost(e) {
  /* Check authorization key */
  var raw = e.postData.contents;
  var req = JSON.parse(raw);
  
  if (req.token === AUTHORIZATION_KEY) {
    var chosenBallots = req.body.ballots;
    var voucher = undefined;
    
    var filteredBallots = filterBallots_(chosenBallots);
    if (filteredBallots.length > 0) {
      voucher = generateVoucher_(filteredBallots);
    }
    
    var resp = {
      'status': 201,
      'body': {
        'voucher': voucher,
      }
    }
    return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput('{"status": 403, "error": "Permission denied."}').setMimeType(ContentService.MimeType.JSON);
  }
}

function showTitle() {
  return ELECTION_TITLE;
}

function authorize(req) {
  var token = req.token;
  var ret = grant_(token, function(auth) {
    var payloads = {
      'booth': auth.booth,
      'ballots': auth.ballots,
      'status': auth.status,
    }
    
    var newToken = updateSecret_(token, payloads);
    return {
      'status': 200,
      'token': newToken,
      'body': {
        'displayName': auth.booth.displayName,
        'ballots': auth.ballots,
        'status': auth.status,
      },
    };
  });
  
  return ret;
}

function login(req) {
  var username = req.body.username.trim();
  var password = req.body.password.trim();

  if ((username.length === 0) || (password.length === 0)) {
     return {
       'status': 403,
       'error': displayError_('INPUT_EMPTY'),
     };
  }

  var booth = authenticate_(username, password);

  var payloads = {
    'booth': booth,
  }
  var token = updateSecret_('LOGIN', payloads);

  log_('INFO', '[LOGIN] <' + booth.displayName + '> successfully login');

  return {
    'status': 200,
    'token': token,
    'body': {
      'displayName': booth.displayName,
    },
  };
}

function logout(req) {
  var token = req.token;
  CacheService.getScriptCache().remove(token);
  return {
    'status': 200,
    'body': {},
  }
}

function redeem(req) {
  var token = req.token;
  var voucher = req.body.voucher.trim();
  
  /* Input data validation */
  var syntaxValid = new RegExp('^\\d{' + VOUCHER_LENGTH + '}$').test(voucher);
  if (!syntaxValid) {
    return {
      'status': 400,
      'error': displayError_('VOUCHER_NOT_COMPLIANT'),
    };
  }

  var ret = grant_(token, function(auth) {
    log_('INFO', '[REDEEM] <' + voucher + '> at <' + auth.booth.displayName + '>');
    
    /* Check if the voucher does not exist or has already been redeemed */
    var availables = fetchVoucher_(voucher);
    if (availables.length === 0) { // No available result
      log_('WARNING', '[REDEEM] <' + voucher + '> duplicated redeem');
      return {
        'status': 400,
        'error': displayError_('VOUCHER_REDEEMED'),
      };
    } else if (availables.length > 1) { // Dulplicated voucher
      return {
        'status': 400,
        'error': displayError_('VOUCHER_DULPLICATED'),
      };
    }
    
    var ballotStr = availables[0];
    var ballots = fetchBallots_(ballotStr);
    var payloads = {
      'booth': auth.booth,
      'ballots': ballots,
      'status': 'pending',
    };
    
    log_('INFO', '[REDEEM] <' + voucher + '> assign <' + ballots.map(function(el) {return el.id}).join(',') + '>');
    
    addRedeemRecord_(voucher);
    var newToken = updateSecret_(token, payloads);

    return {
      'status': 200,
      'token': newToken,
      'body': {
        'ballots': ballots,
      },
    };
  });
  return ret;
}

function load(req) {
  var token = req.token;
  
  var ret = grant_(token, function(auth) {
    var ballots = auth.ballots;
    var authCodes = {}
    
    ballots.forEach(function(elm) {
      authCodes[elm.id] = pickBallot_(elm.id);
    })
    
    var url = renderBallotUrl_(authCodes);
    
    log_('INFO', '[LOAD] <' + auth.booth.displayName + '> load ballots');
    
    var payloads = {
      'booth': auth.booth,
      'ballots': ballots,
      'status': 'voting',
    };
    var newToken = updateSecret_(token, payloads);
    
    return {
      'status': 200,
      'token': newToken,
      'body': {
        'url': url,
      },
    };
  });
  return ret;
}

function unlock(req) {
  var token = req.token;
  
  var ret = grant_(token, function(auth) {
    var unlocker = req.body.unlocker;
    
    if (!isUnlocker_(auth.booth.id, unlocker)) {
      log_('WARNING', '[UNLOCK] <' + auth.booth.displayName + '> fail unlocking');
      return {
        'status': 400,
        'error': displayError_('WRONG_UNLOCKER'),
      };
    }
    
    log_('INFO', '[UNLOCK] <' + auth.booth.displayName + '> unlock successfully');
    
    var payloads = {
      'booth': auth.booth,
    };
    var newToken = updateSecret_(token, payloads);
    
    return {
      'status': 200,
      'token': newToken,
      'body': {
        'displayName': auth.booth.displayName,
      },
    };
  });
  
  return ret;
}