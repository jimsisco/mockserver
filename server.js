const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();
const _ = require('lodash')
const { faker } = require('@faker-js/faker');
const fs = require('fs');

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares)
server.use(jsonServer.bodyParser)

// Load Valid TR Iitems from Created by Jim S.
const csv = require('csv-parser');
const { json, text } = require('stream/consumers');
const { log } = require('console');
const validTrItems = [];

// Open and save valid TR products to an array Created by Jim S.
fs.createReadStream('validTrItems.csv')
    .pipe(csv())
    .on('data', (data) => validTrItems.push(data))
    .on('end', () => {
        logEvent('Finshed loading valid items');
});

// Log events to file and write to console Created By Jim S.
function logEvent(message) {
    const fs = require('fs');
    const timestamp = new Date().toISOString();
    const writeLogMessage = `${timestamp} - ${message.toString()}\n`;
    const sendToConsole = `${timestamp} - ${message.toString()}`;
    
    fs.appendFile('mcokserver.log', writeLogMessage, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
        // Write message to console
        console.log(sendToConsole);
    });
  }

// Function to update db.json on local file system Created by Jim S.
// Save data to Json.db 
function updateRouterDatabase(data, type) {
    const filePath = './db.json';

    try {
        // Open the file
        const rawData = fs.readFileSync(filePath); 
        // Parse file
        const jsonData = JSON.parse(rawData); 
        // Add data to json array based on type
        if (type === 'shipments') {
            jsonData.shipments.push(data)
        } else if (type === 'orders') {
            jsonData.orders.push(data)
        } else if (type === 'customer') {
            jsonData.cusotmers.push(data)
        } else if (type === 'returns') {
            jsonData.returns.push(data);
        }else if (type === 'getNextIds') {
            jsonData.getNextIds= data;
        } else {
            console.log('Type '+type+' could not be found')
        }

        // Refresh the router's internal state
        router.db.setState(jsonData); 

        // Save changes to db.json
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 3));
        
        console.log(data) 
        return true

    } catch {
        console.error("db.json was not updated");
        return false
    }
};

// Function creates PUT order response Created by jims
function creatOrderResponse(data) {
    const lineItems = data.lineItems
    const shipmentMsgs = []
    const shipmentLines = []
    const orderItemLines = []
    const failures = []
   
    // Setup tracking number based on shippers format
    function createTrackingItems(numberOfTrackingNumbers) { 
        let count = 0;
        let trackingNumbers = [];
        while (count < numberOfTrackingNumbers) {
            if (data.shipMethod == 'LTL') {
                    trackingNumber = '1Z'+faker.number.int(10000000000000,90000000000000)
                } else if (data.shipMethod == 'USPS') {
                    trackingNumber = '1Z'+faker.number.int(10000000000000,90000000000000)
                } else if (data.shipMethod == 'USP') { 
                    trackingNumber = '1Z'+faker.number.int(10000000000000,90000000000000)
                } else {
                    trackingNumber = '1Z'+faker.number.int(10000000000000,90000000000000)
                }
                //Save tracking numbers to list
                trackingNumbers.push(trackingNumber);
                count += 1;
            }
            return trackingNumbers
    }
    // Create Shipment Line Items
    function createShipmentLineItems(lineItem, shipmentId, trackingNumbers){       
        let shipmentsLineItemDetails = {
            'carrier': data.shipMethod,
            'id': shipmentId,
            'orderId': data.id,
            'orderType': 'warehouse',
            'shipDate': data.orderDate,
            'shipmentItems': [
                {
                'lineItemId': lineItem.externalLineNumber,
                'quantity': lineItem.quantity
                }
            ],
            'totalWeight': 1.4,
            'trackingNumbers': trackingNumbers   
        }
        shipmentLines.push(shipmentsLineItemDetails);
    }

    //Create shipment header Created by jims
    function createShipmentMsg(lineItem, shipmentId, trackingNumbers) {
        // Create Shipment lines
        let shipmentLines = createShipmentLineItems(lineItem, shipmentId, trackingNumbers);
        let shipmentMsg = {
            'id': shipmentId,
            'carrier': data.shipMethod,
            'orderId': data.id,
            'shipDate': data.orderType,
            'orderType': 'warehouse',
            'totalWeight': 1.5,
            'shipmentItems': shipmentLines,
            }
        shipmentMsgs.push(shipmentMsg)
    }

    //Get Next ShipmentId Created by jims
    function getNextShipmentId() {
        
        const fs = require('fs')
        // Read the JSON file
        getNextIdfilePath = 'getNextId.json';

        const getNextIdData = fs.readFileSync(getNextIdfilePath) 

        // Parse the JSON data
        let jsonData = JSON.parse(getNextIdData);
        let currentShipmentId = jsonData.shipmentId;
        let newShipmentId = currentShipmentId + 1;

        //  Update the JSON data
        jsonData.shipmentId = newShipmentId

        // Convert the JSON data back to a string
        const updatedJsonData = JSON.stringify(jsonData, null, 2);

        // Write the updated JSON data back to the file
        fs.writeFileSync(getNextIdfilePath, updatedJsonData, null, 3);
        logEvent('New Shipment Id Created: '+ newShipmentId);
        return newShipmentId;  
    }

    // For each order item line create a response based on TR format.
    for (let lineItem  of lineItems){
        let returns = [];
        let shipmentId = getNextShipmentId()
        
        // create tracking numbers based on quantity
        if (lineItem.quantity <= 10) {
            requiredTrackingIdS = 1;
        } else if (lineItem.quantity == 20) {
            requiredTrackingIdS = 2;
        } else if (lineItem.quantity == 30) {
            requiredTrackingIdS = 3;
        } else {
            requiredTrackingIdS = 1;
        }

        let trackingNumbers = createTrackingItems(requiredTrackingIdS);

        // creates shipping objects
        let createShipmentObjects = createShipmentMsg(lineItem=lineItem, shipmentId, trackingNumbers);
        
        // Create Order Line Items
        let lineItemDetails = {
            'canceled': false,
            'id': lineItem.externalLineNumber,
            'orderId': data.id,
            'pricesPerUnit': lineItem.pricesPerUnit,
            'productId': lineItem.productId,
            'quantity': lineItem.quantity,
            'returns': returns, 
            'shipmentIds': [shipmentId],
            'externalLineNumber': lineItem['externalLineNumber']
        }
        orderItemLines.push(lineItemDetails);

        let shipmentata = {
            "eventId": "shipment",    
            "resourceName": "shipments",
            "resourceId": shipmentId,
        }
    }
    return [shipmentMsgs, shipmentLines, orderItemLines, failures];
}

// Adds hyphens to a GUID created by jims
function addHyphensToGuid(guid) {
    // Insert hyphens in the correct positions
    return `${guid.slice(0, 8)}-${guid.slice(8, 12)}-${guid.slice(12, 16)}-${guid.slice(16, 20)}-${guid.slice(20)}`;
  }
  
// Add custom routes before JSON Server router
server.get('/health-check', (req, res) => {
    res.jsonp({"status": "ok"});
})

// Shipments Sections
// Posts order data to db.json and provides a response
// Created by Jim S.
server.post('/v1/shipments', (req, res, ) => {
    const data = req.body;
    const dbType = 'shipments';
    response = updateRouterDatabase(data, dbType);
   
    if (data === response) {
        data = {error: "missing shipment"}
        res.status(404).jsonp(data)
    } else {
        errorMesg =  {userMessage: "The db.json file has been updated", technicalMessage: "The db.json file has been updated"} 
        res.status(201).json(errorMessage)
    }
})

server.get('/v1/shipments', (req, res) => {
    var data = router.db.get('shipments').value()
    if (data === undefined) {
        res.status(404)
        data = {userMessage: "missing shipment", technicalMessage: "missing shipment"};
        logEvent('Get Shipments failed: '+JSON.stringify(data));
        res.jsonp(data);
    } else {
        logEvent('Get Shipment with Id: '+JSON.stringify(data));
        res.jsonp(data);
    }
})

server.get('/v1/shipments/:id', (req, res) => {
    var shipments = router.db.get('shipments').value()
    data = _.find(shipments, ['id', Number(req.params.id)])

    if (data === undefined) {
        res.status(404)
	    data = {userMessage: "missing shipment", technicalMessage: "missing shipment"};
        res.jsonp(data);
        logEvent('Get Shipment '+req.params.id+' failed: '+JSON.stringify(data));
    } else {    
        res.jsonp(data);
        logEvent('Get Shipment with Id: '+JSON.stringify(data));
    }
})

// TR Order Endpoints
// Put order created by Jim S.
server.put('/v1/orders/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    const responseData = data;
    logEvent('Starting Mock TR order processing for BC order number #'+id);

    // validate shipTo
    const shipToValidationErrors = [];
    function validateShipTo() {
        let shipTo = responseData['shipTo'];
        
        if (shipTo['nameLine1'] === '') {
            errorMsg = 'The Ship To address was not valid for the following reasons: Name Line 1 must be provided.';
            shipToValidationErrors.push(errorMsg)
        } if (shipTo['addressLine1'] === ''){
            errorMsg = 'The Ship To address was not valid for the following reasons: Address Line 1 must be provided.';
            shipToValidationErrors.push(errorMsg)
        } if (shipTo['city'] === ''){
            errorMsg = 'The Ship To address was not valid for the following reasons: City must be provided.';
            shipToValidationErrors.push(errorMsg)
        } if (shipTo['contryCode'] === ''){
            errorMsg = 'The Ship To address was not valid for the following reasons: Contry Code must be provided.';
            shipToValidationErrors.push(errorMsg)
        } if (shipTo['regionCode'] === ''){
            errorMsg = 'The Ship To address was not valid for the following reasons: Region Code must be provided.';
            shipToValidationErrors.push(errorMsg)
        }
        
        // Return results
        if (shipToValidationErrors.length > 0) {
            return false
        } else {
            return true 
        }
    }

    // validate billTo  Created by jims
    const billToValidationErrors = [];
    function validatebillTo() {
        let billTo = responseData['billTo'];
        
        if (billTo['nameLine1'] === '') {
            errorMsg = 'The Bill To address was not valid for the following reasons: Name Line 1 must be provided.';
            billToValidationErrors.push(errorMsg)
        } if (billTo['addressLine1'] === ''){
            errorMsg = 'The Bill To address was not valid for the following reasons: Address Line 1 must be provided.';
            billToValidationErrors.push(errorMsg)
        } if (billTo['city'] === ''){
            errorMsg = 'The Bill To address was not valid for the following reasons: City must be provided.';
            billToValidationErrors.push(errorMsg)
        } if (billTo['contryCode'] === ''){
            errorMsg = 'The Bill To address was not valid for the following reasons: Contry Code must be provided.';
            billToValidationErrors.push(errorMsg)
        } if (billTo['regionCode'] === ''){
            errorMsg = 'The Bill To address was not valid for the following reasons: Region Code must be provided.';
            billToValidationErrors.push(errorMsg)
        }
        // 'The Bill To address was not valid for the following reasons: Name Line 1 must be provided.'
        if (billToValidationErrors.length > 0) {
            return false 
        } else {
            return true
        }
    }

    // Validate Quantity Created by jims
    const quantityvalidationErrors = [];
    function validateQuantity() {
        let lineItems = data.lineItems;
        let totalLineItems = lineItems.length;
        
        let currentLineNumber = 1;
        for (line of lineItems) {
            let quantity = Number.isInteger(line['quantity']);
            if (quantity === false) {
                msg = 'Line item '+currentLineNumber+' of '+totalLineItems+' was not valid for the following reasons: Quantity is not a valid integer';
                quantityvalidationErrors.push(msg);
                logEvent(msg)
            } 
            if (line['quantity'] === 0) {
                msg = 'Line item '+currentLineNumber+' of '+totalLineItems+' was not valid for the following reasons: Quantity must be between 1 and 9999999999.';
                quantityvalidationErrors.push(msg);
                logEvent(msg);
            } 
            if (line['quantity'] > 9999999999) {
                msg = 'Line item '+currentLineNumber+' of '+totalLineItems+' was not valid for the following reasons: Quantity must be between 1 and 9999999999.';
                quantityvalidationErrors.push(msg);
                logEvent(msg)
            }
            currentLineNumber += 1;
        }

        if (quantityvalidationErrors.length > 0){
            return false;
        } else {
            return true;
        }
    }

    // Validate Product exists on TR's side. Created by jims
    const invalidProductIds = []
    function validateProductId(){
        let lineItems = data.lineItems;
        for (item of lineItems){
            for (validTrItem of validTrItems) {
                if (item.productId == validTrItem.id)
                    return true
            }
            invalidProductIds.push(item)
        } if (invalidProductIds.length > 0) {
            return false
        }
          
    }

    // Validate BillTo, ShipTo, Item Quantity, and if product id exist on tr's side
    // check to see if shipTo and billTo objects exist in request
    if ('shipTo' in responseData) {
        shipTovalidationStatus = validateShipTo();   
    }
    if ('billTo' in responseData) {
        billToValidatidationStatus = validatebillTo();
    } else {
        billToValidatidationStatus = true;    
    }

    // Validate Quantity
    const validateQuanityStatus = validateQuantity();
    // Validate Products
    const validationProdutIdStatus = validateProductId();
    
    // Error Handling to determine if there were any failures
    const validationAssessmentFailures = []
    function validationAssessment() {
        if (billToValidatidationStatus === false) {
            validationAssessmentFailures.push('billTo');
        } if (shipTovalidationStatus === false) {
            validationAssessmentFailures.push('shipTo');
        } if (validateQuanityStatus === false) {
            validationAssessmentFailures.push('quantity');
        } if (validationProdutIdStatus === false) {
            validationAssessmentFailures.push('productId');
        }
        
        // Return response
        if (validationAssessmentFailures.length > 0) {
            logEvent('Validation issues were found '+JSON.stringify(validationAssessmentFailures))
            return false;
        } else { 
            logEvent('Validation process has compelted with no errors found')
            return true;
        }
    }
    
    // See which validations failed 
    let validationAssessmentStatus = validationAssessment();

    // Response message if True
    if (validationAssessmentStatus === true) {

        // create create Order respponse and update db.json
        let shipmentJsonMsg = creatOrderResponse(data);
        logEvent('The order number "'+ id + ' shipment was created');
    
        //Push the updated data set to db.json and send
        responseData['shipments'] = shipmentJsonMsg[1];
        let getLineItems = shipmentJsonMsg[1];
        let lineItems = shipmentJsonMsg[2];
        let externalOrderId = addHyphensToGuid(data.externalOrderId); // Disale adding Hyphens
        delete responseData.billTo;
        responseData['externalOrderId'] = externalOrderId;
        responseData['lineItems'] = lineItems;
        responseData['completeDelivery'] = true;
        logEvent('Response: '+JSON.stringify(responseData));
        
        //post the shipment to db.json
        let shipments = shipmentJsonMsg[1];
        updateRouterDatabase(shipments[0], 'tr_shipments');
        logEvent('The shipment for order number '+id+' was added to the db.json')
       
        //post the order to db.json
        orderAdded = updateRouterDatabase(responseData, 'orders');
        logEvent('The order number '+id+' was added to the db.json')
        
        // send response
        res.status(201).jsonp(responseData);
        logEvent('Compelted adding mock TR order processing for BC order #'+id);
        return  
      
    } else {
        // create error response based on type of errors that were found
        const errorResponseMessage = [];
        if  (validationAssessmentFailures.includes('billTo')) { 
            for (billToError of billToValidationErrors) {
                errorResponseMessage.push(billToError);
            }
        } if (validationAssessmentFailures.includes('shipTo')) {
            for (shipToError of shipToValidationErrors) {
                errorResponseMessage.push(shipToError);
            }
        } if (validationAssessmentFailures.includes('quantity')) {
            for (quantityError of quantityvalidationErrors) {
                errorResponseMessage.push(quantityError);
            }
        } if (validationAssessmentFailures.includes('productId')) {
            for (productIdError in invalidProductIds) {
                errorResponseMessage.push("missing record");
            }
        }

        let errorResponse = '';
        for (let errorMessage of errorResponseMessage) {
            errorResponse += errorMessage+'\n ';
        }
        
        // Chreate Error Respoonse
        response = {userMessage: errorResponse, technicalMessage: errorResponse}
        logEvent('Error response created')

        // Send Falilure Response
        res.status(404).jsonp(response);
        logEvent('Mock TR order processing FAILED for order # '+id);
        logEvent('Failure Reason: '+JSON.stringify(response));
    }
})

server.get('/v1/orders/:id', (req, res) => {
    // Get query parameters
    const finishedShipping = req.query.finishedShipping == 'true';
    const orderId = req.params.id;
    // Fetch data from db.json
    const orders = router.db.get('tr_orders').value();
    data = _.find(orders, ['id', req.params.id]);

    // Check if data exists, else return an error
    if (!data || data.length === 0) {
        data = {userMessage: "No orders found matching criteria", technicalMessage: "No orders found matching criteria"}
        res.status(404).jsonp(data);
    } else {
        let results = [];
        results.push(data);        
        res.jsonp(results);
    }
})

server.get('/v1/orders', (req, res) => { 
    const finishedShipping = req.query.finishedShipping === 'true';
    var orders = router.db.get('tr_orders').value()
    if (req.query.id === undefined) {
        return res.jsonp(orders);
    } 
    
    let query = req.query.id
    let getOrder = _.find(orders, ['id', query]);
    
    if (getOrder === undefined) {finishedShipping
        res.status(404);
        data = {userMessage: "No orders found matching criteria", technicalMessage: "No orders found matching criteria"};
        return res.jsonp(data);
    }

    let results = [];
    results.push(getOrder);        
    res.jsonp(results);
      
})

// Retruns Section
// Get return orders Created by Jim S.
server.get('/v1/returns', (req, res) => {
    const returnDate = req.query.returnedAfter;
    var getReturnResults = [];
    var results = [];
    var tr_returns = router.db.get('tr_returns').value();
    
    for (tr_return of tr_returns) {
        const trReturnDate = new Date(tr_return.returnDate);
        const searchDate = new Date(returnDate+'T15:00:00.000Z');
        if (trReturnDate >= searchDate) {
            getReturnResults.push(tr_return);
        }
    }
    results.push(getReturnResults);
    if (results === undefined) {
        res.status(200).jsonp(data);
        logEvent('Return orders were not found'+JSON.stringify(response));;
    }
    response = getReturnResults;
    res.status(200).jsonp(response);
    logEvent('Return orders were found'+JSON.stringify(response));
})

// POST Returns Created by Jim S.
server.post('/v1/returns', (req, res) => {
    const data = req.body;
    const getNextIds = router.db.get('tr_getNextIds').value();

    for (const getNextId of getNextIds) {
        if (getNextId.hasOwnProperty('tr_current_return_id')) {
            let currentReturnId = getNextId.tr_current_return_id ;
            newReturnId = currentReturnId + 1;
            getNextIds[0].tr_current_return_id = newReturnId;
        }
    }

    // Update the db.json file with the new return id
    updateRouterDatabase(getNextIds, 'tr_getNextIds');
   
    // Update the return id in the data object
    data.id = newReturnId;
    data['isAddedBackToInventory'] = 1;
    
    // Add retur into the db.json tr_returns array
    response = updateRouterDatabase(data, 'tr_returns');
    
    // Send response
    if (data === response) {
        data = response = {userMessage: 'Return could not be added', technicalMessage: 'Return could not be added'};
        logEvent('Post return order to the mockserver has failed: '+JSON.stringify(data));
        res.status(404).jsonp(data);
    } else {
        logEvent('Post return order was successful. '+ JSON.stringify({userMessage: "The return was added to the db.json file", technicalMessage: "The return was added to the db.json file"}));
        res.status(201).json(data);
    }
})

// Utilities
// Refresh db.json file after it's been updated manually. Created by Jim S.
server.post('/v1/refresh-dbjson', (req, res) => {     
    const filePath = './db.json';
    
    try {
        // Open the file
        const rawData = fs.readFileSync(filePath); 
        // Parse file
        const jsonData = JSON.parse(rawData); 
        // Refresh the router's internal state
        router.db.setState(jsonData); 
        // Send response    
        res.status(200).jsonp({message: 'db.json was refreshed'});
        logEvent('db.json was refreshed')

    } catch {
        logEvent("db.json was not updated");
        return false
    } 
})

// Hello World Created by Jim S.
server.get('/v1/helloworld', (req, res) => {     
    
    try {
       
        hwName = req.query.name
        // Send response    
        res.status(200).jsonp('Well howdy ' + hwName);
        logEvent('Well howdy'+ hwName)

    } catch {
        logEvent("whoops something happend");
        return false
    } 
})

// Middleware if there are special handling we want to do to some requests
server.use((req, res, next) => {
    //Pass to next middleware
    next()
})

// Handle how responses are returned for special uses cases like 404s
router.render = (req, res) => {
    if (res.statusCode === 404) {
        res.jsonp({
            error: 'missing record'
        })
    }
}

// Load router
server.use(router)

// Start Server
server.listen(3000, () => {
  logEvent('Mock Server is running')
})